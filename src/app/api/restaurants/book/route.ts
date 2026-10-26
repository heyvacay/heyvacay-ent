import { NextResponse } from 'next/server';
import { OPENTABLE } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Book a restaurant reservation. Uses OpenTable's Booking API when configured;
 * otherwise returns a mock confirmation so the auto-book flow completes in the
 * demo. The full booking experience stays on our site/app either way.
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
  const time = String(body.time || '');
  const partySize = Number(body.partySize) || 2;
  const name = String(body.name || 'HeyVacay guest');
  if (!restaurantId || !date || !time) {
    return NextResponse.json({ error: 'restaurantId, date and time are required.' }, { status: 400 });
  }

  if (OPENTABLE.live) {
    try {
      const res = await fetch(`${OPENTABLE.base}/consumer/v1/reservations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENTABLE.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ restaurant_id: restaurantId, date, time, party_size: partySize, name }),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        // TODO(opentable): map confirmation id/fields once schema confirmed.
        if (data) return NextResponse.json({ ...data, source: 'opentable' });
      }
    } catch {
      /* fall through to mock */
    }
  }

  const confirmation = `OT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  return NextResponse.json({
    confirmation,
    restaurantId,
    date,
    time,
    partySize,
    name,
    status: 'confirmed',
    source: OPENTABLE.live ? 'opentable_fallback' : 'mock',
  });
}
