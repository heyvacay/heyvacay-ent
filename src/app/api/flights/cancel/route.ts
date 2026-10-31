import { NextResponse } from 'next/server';
import { isLiveBooking } from '@/lib/config.server';
import { backendFetch } from '@/lib/backendAuth.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Flight cancellation — cancel the Duffel order + refund (service-account authed). */
export async function POST(req: Request) {
  if (!isLiveBooking()) {
    return NextResponse.json({ error: 'live_booking_disabled' }, { status: 501 });
  }
  let body: { bookingRef?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const ref = body.bookingRef;
  if (!ref) return NextResponse.json({ error: 'bookingRef is required.' }, { status: 400 });
  try {
    const res = await backendFetch(`/flights/bookings/${encodeURIComponent(ref)}/cancel`, {
      method: 'POST',
      body: {},
    });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json(
      { error: 'backend_unavailable', message: (e as Error).message },
      { status: 502 }
    );
  }
}
