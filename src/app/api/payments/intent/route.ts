import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Generic, ORDERLESS payment intent — demo only.
 *
 * A real hotel/flight charge must always be tied to a locked supplier order, so
 * every real charge goes through the order flow (prebook → confirm/capture) in
 * liveBooking.ts, where the backend mints the PaymentIntent against the
 * prebooked order and money + the RateHawk/Duffel order are issued together.
 *
 * This endpoint therefore never creates a real charge. Returning {demo:true}
 * makes the generic checkout show a no-charge demo card form — so there is no
 * way to take money without a booking. (Kept as an endpoint so the existing
 * demo checkout component keeps working when live booking is off.)
 */
export async function POST(req: Request) {
  try {
    await req.json();
  } catch {
    /* body is optional for the demo path */
  }
  return NextResponse.json({ demo: true });
}
