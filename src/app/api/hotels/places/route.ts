import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SuggestResult {
  kind: 'region' | 'hotel' | 'place';
  data: {
    id?: number | string;
    name?: string;
    type?: string;
    country_name?: string;
    country_code?: string;
    admin1_name?: string;
    center?: { latitude: number; longitude: number };
    location?: { latitude: number; longitude: number };
  };
}

/**
 * Destination typeahead for hotels → proxies /hotels/global-suggest and
 * normalizes to region picks (each carries the region_id the hotel search
 * needs). We surface regions only; a region_id is what /search/region/start
 * keys on.
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

    const results = raw
      .filter((r) => r.kind === 'region' && r.data?.id != null)
      .slice(0, 8)
      .map((r) => {
        const d = r.data;
        const sub = [d.admin1_name, d.country_name || d.country_code]
          .filter(Boolean)
          .join(', ');
        return {
          regionId: Number(d.id),
          label: d.name ?? '',
          sub,
          lat: d.center?.latitude,
          lng: d.center?.longitude,
        };
      });

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
