import { NextResponse } from 'next/server';
import { isLiveBooking } from './config.server';
import { backendFetch } from './backendAuth.server';

/**
 * Forward a booking step to the shared backend as the Enterprise service
 * account. Thin, faithful proxy: the client builds the supplier payload
 * (exactly like heyvacay.co does), we attach auth and pass status + body
 * straight back so the checkout can branch on supplier status codes
 * (price_changed, no_longer_available, timeout, …).
 *
 * When live booking isn't configured we return 501 so the client can fall back
 * to recording the trip in the workspace without a real order.
 */
export async function forwardBooking(
  req: Request,
  backendPath: string
): Promise<NextResponse> {
  if (!isLiveBooking()) {
    return NextResponse.json(
      { error: 'live_booking_disabled', message: 'Live booking is not configured.' },
      { status: 501 }
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  try {
    const res = await backendFetch(backendPath, { method: 'POST', body });
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json(
      { error: 'backend_unavailable', message: (e as Error).message },
      { status: 502 }
    );
  }
}
