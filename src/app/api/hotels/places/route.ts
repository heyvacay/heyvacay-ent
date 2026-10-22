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

// Region-type keywords that represent a real destination — matched as
// case-insensitive substrings (so "City", "Austin (City)", "multi_city_vicinity"
// all pass), exactly like the consumer's isDestinationRegionType. Strips supplier
// junk like transit entrances / stations / POIs / airports.
const DEST_REGION_KEYWORDS = [
  'city',
  'region',
  'province',
  'state',
  'country',
  'continent',
  'neighborhood',
  'neighbourhood',
  'district',
  'vicinity',
  'island',
];
const isDestinationRegionType = (type?: string): boolean => {
  const t = (type ?? '').toLowerCase();
  return t.length > 0 && DEST_REGION_KEYWORDS.some((k) => t.includes(k));
};

// Suggestion ranking — mirrors the consumer so a city that matches the query as
// an exact/prefix gets pinned above hotels, otherwise match strength wins.
const NOISE = new Set([
  'hotel', 'hotels', 'inn', 'resort', 'resorts', 'suite', 'suites',
  'motel', 'lodge', 'hostel', 'the', 'and', 'of', 'a', 'an',
]);
const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function scoreName(name: string, query: string): number {
  const n = norm(name);
  const q = norm(query);
  if (!q || !n) return 0;
  const exact = (nn: string, qq: string) =>
    !qq ? 0 : nn === qq ? 1000 : nn.startsWith(qq) ? 900 : nn.includes(qq) ? 800 : 0;
  const tokens = q.split(/\s+/).filter(Boolean).filter((t) => !NOISE.has(t));
  const base = Math.max(exact(n, q), exact(n, tokens.join(' ')));
  if (base > 0) return base;
  if (tokens.length === 0) return 0;
  const matched = tokens.filter((t) => n.includes(t)).length;
  return matched === 0 ? 0 : Math.round((matched / tokens.length) * 700);
}

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
          r.kind === 'region' &&
          r.data?.id != null &&
          isDestinationRegionType(r.data.type)
      )
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

    // Rank with the consumer's priorities: a region whose name matches the query
    // exactly or as a prefix leads (placeLead); otherwise raw match strength wins
    // (so a specific hotel can outrank a weak city match); regions break ties.
    const ranked = [...regions, ...hotels]
      .map((item, i) => {
        const tier = item.type === 'region' ? 0 : 2;
        const s = scoreName(item.label, q);
        const placeLead = tier <= 1 && s >= 900 ? 1 : 0;
        return { item, i, tier, s, placeLead };
      })
      .sort(
        (a, b) =>
          b.placeLead - a.placeLead || b.s - a.s || a.tier - b.tier || a.i - b.i
      )
      .slice(0, 10)
      .map((x) => x.item);

    return NextResponse.json({ results: ranked });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
