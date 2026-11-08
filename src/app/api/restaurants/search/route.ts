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

  if (OPENTABLE.live) {
    try {
      const live = await searchDirectory(city, genre);
      if (live.length) {
        return NextResponse.json({ restaurants: live, source: 'opentable' });
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
