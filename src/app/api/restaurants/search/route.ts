import { NextResponse } from 'next/server';
import { OPENTABLE } from '@/lib/config.server';
import { searchDirectory } from '@/lib/opentable.server';
import { searchRestaurants } from '@/lib/restaurants.mock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Restaurant directory search. When OpenTable credentials are configured we page
 * the live Directory API (cached in-memory) and filter by city/genre; otherwise
 * we return the built-in mock directory so the dinner and event flows work in
 * the demo. If a live search yields no match for the city, we fall back to mock
 * so the UI is never empty.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }
  const city = typeof body.city === 'string' ? body.city : undefined;
  const genre = typeof body.genre === 'string' ? body.genre : undefined;
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const LIMIT = 150;

  if (OPENTABLE.live) {
    try {
      const live = await searchDirectory(city, genre, name);
      if (live.length) {
        // Full-city coverage can be hundreds of venues; return the top matches
        // by rating (then review weight) so the grid stays usable. The name
        // query already narrowed to the specific restaurant(s) when present.
        const ranked = [...live]
          .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          .slice(0, LIMIT);
        return NextResponse.json({
          restaurants: ranked,
          total: live.length,
          source: 'opentable',
        });
      }
    } catch {
      /* fall through to mock */
    }
  }

  return NextResponse.json({
    restaurants: searchRestaurants(city, genre),
    source: OPENTABLE.live ? 'opentable_fallback' : 'mock',
  });
}
