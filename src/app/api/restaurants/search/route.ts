import { NextResponse } from 'next/server';
import { OPENTABLE } from '@/lib/config.server';
import { searchRestaurants } from '@/lib/restaurants.mock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Restaurant directory search. Uses OpenTable's Directory API when credentials
 * are configured; otherwise returns the built-in mock directory so the dinner
 * and event flows work in the demo. See docs/opentable.md for the exact
 * request mapping to finalize once keys are live.
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
      const res = await fetch(`${OPENTABLE.base}/directory/v1/restaurants?q=${encodeURIComponent(city ?? '')}`, {
        headers: { Authorization: `Bearer ${OPENTABLE.apiKey}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        // TODO(opentable): map data.restaurants -> our shape once schema confirmed.
        if (Array.isArray(data?.restaurants) && data.restaurants.length) {
          return NextResponse.json({ restaurants: data.restaurants, source: 'opentable' });
        }
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
