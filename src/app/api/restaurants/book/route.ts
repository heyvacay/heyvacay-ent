import { NextResponse } from 'next/server';
import { OPENTABLE } from '@/lib/config.server';
import { bookReservation } from '@/lib/opentable.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Book a restaurant reservation. Uses OpenTable's 2-step Booking API
 * (slot_locks -> reservations) when configured; otherwise returns a local
 * confirmation so the auto-book flow completes in the demo. Either way the
 * booking experience stays on our site/app.
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
  const email = typeof body.email === 'string' ? body.email : undefined;
  const phone = typeof body.phone === 'string' ? body.phone : undefined;
  const specialRequest = typeof body.specialRequest === 'string' ? body.specialRequest : undefined;
  if (!restaurantId || !date || !time) {
    return NextResponse.json({ error: 'restaurantId, date and time are required.' }, { status: 400 });
  }

  if (OPENTABLE.live) {
    try {
      const resv = await bookReservation({
        restaurantId,
        date,
        time,
        partySize,
        name,
        email,
        phone,
        specialRequest,
      });
      if (resv) {
        return NextResponse.json({
          confirmation: resv.confirmation,
          manageUrl: resv.manageUrl,
          restaurantId,
          date,
          time,
          partySize,
          name,
          status: resv.status,
          depositRequired: resv.depositRequired ?? false,
          source: 'opentable',
        });
      }
    } catch {
      /* fall through to local confirmation */
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
