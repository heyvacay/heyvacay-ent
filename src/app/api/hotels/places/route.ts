import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SuggestRegion {
  id?: number;
  name?: string;
  type?: string;
  country_code?: string;
  country_name?: string;
  admin1_name?: string;
  center?: { latitude?: number; longitude?: number };
}
interface SuggestHotel {
  id?: string;
  hid?: number;
  name?: string;
  address?: string;
  star_rating?: number;
  region?: { id?: number; name?: string; admin1_name?: string; country_code?: string };
  location?: { latitude?: number; longitude?: number };
}
type SuggestResult =
  | { kind: 'region'; data: SuggestRegion }
  | { kind: 'hotel'; data: SuggestHotel };

// Region types that represent a real destination (strips supplier junk like
// transit stops), mirroring the consumer's isDestinationRegionType.
const DEST_REGION_TYPES = new Set([
  'city',
  'region',
  'province_state',
  'province',
  'state',
  'country',
  'continent',
  'neighbourhood',
  'neighborhood',
  'district',
  'google',
  'multi_city_vicinity',
  'municipality',
  'island',
  'metropolitan_area',
]);

/**
 * Destination typeahead for hotels → proxies /hotels/global-suggest and returns
 * both destination regions and specific hotels, the way HeyVacay.co's search
 * box does. A region pick searches by region_id; a hotel pick searches by its
 * region (or its own coordinates) and pins the hotel.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const res = await fetch(`${API_BASE_URL}/hotels/global-suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: q }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    const raw: SuggestResult[] = Array.isArray(data?.results) ? data.results : [];

    const regions = raw
      .filter(
        (r): r is { kind: 'region'; data: SuggestRegion } =>
          r.kind === 'region' && r.data?.id != null
      )
      .filter((r) => !r.data.type || DEST_REGION_TYPES.has(r.data.type))
      .slice(0, 6)
      .map((r) => {
        const d = r.data;
        return {
          type: 'region' as const,
          regionId: Number(d.id),
          label: d.name ?? '',
          sub: [d.admin1_name, d.country_name || d.country_code]
            .filter(Boolean)
            .join(', '),
          lat: d.center?.latitude,
          lng: d.center?.longitude,
        };
      });

    const hotels = raw
      .filter(
        (r): r is { kind: 'hotel'; data: SuggestHotel } =>
          r.kind === 'hotel' && r.data?.hid != null
      )
      .slice(0, 6)
      .map((r) => {
        const d = r.data;
        return {
          type: 'hotel' as const,
          hid: Number(d.hid),
          regionId: d.region?.id != null ? Number(d.region.id) : undefined,
          label: d.name ?? '',
          sub: [d.region?.name, d.region?.admin1_name, d.region?.country_code]
            .filter(Boolean)
            .join(', '),
          lat: d.location?.latitude,
          lng: d.location?.longitude,
          star: d.star_rating,
        };
      });

    // Regions first (destinations), then specific hotels — same priority order
    // the consumer uses for a city-style query.
    return NextResponse.json({ results: [...regions, ...hotels] });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
