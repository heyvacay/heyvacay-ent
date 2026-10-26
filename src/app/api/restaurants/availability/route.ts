import { NextResponse } from 'next/server';
import { OPENTABLE } from '@/lib/config.server';
import { mockAvailability } from '@/lib/restaurants.mock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Single-search availability for one restaurant/date/time/party. Critically,
 * when the requested time is not available we still return nearby bookable
 * times with requestedAvailable:false, so the UI makes clear the requested
 * time is unavailable and offers the closest alternatives.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const restaurantId = String(body.restaurantId || '');
  const date = String(body.date || '');
  const time = String(body.time || '19:00');
  const partySize = Number(body.partySize) || 2;
  if (!restaurantId || !date) {
    return NextResponse.json({ error: 'restaurantId and date are required.' }, { status: 400 });
  }

  if (OPENTABLE.live) {
    try {
      const res = await fetch(`${OPENTABLE.base}/consumer/v1/availability`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENTABLE.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ restaurant_id: restaurantId, date, time, party_size: partySize }),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        // TODO(opentable): map data.slots -> {requestedAvailable, slots[]} once schema confirmed.
        if (data?.slots) {
          return NextResponse.json({ ...data, source: 'opentable' });
        }
      }
    } catch {
      /* fall through to mock */
    }
  }

  return NextResponse.json({
    ...mockAvailability(restaurantId, date, time, partySize),
    source: OPENTABLE.live ? 'opentable_fallback' : 'mock',
  });
}
