import { NextResponse } from 'next/server';
import { isLiveBooking } from '@/lib/config.server';
import { backendFetch } from '@/lib/backendAuth.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Poll a hotel order's status after confirm (service-account authed). */
export async function GET(req: Request) {
  if (!isLiveBooking()) {
    return NextResponse.json({ error: 'live_booking_disabled' }, { status: 501 });
  }
  const ref = new URL(req.url).searchParams.get('ref');
  if (!ref) return NextResponse.json({ error: 'ref is required.' }, { status: 400 });
  try {
    const res = await backendFetch(`/bookings/${encodeURIComponent(ref)}/status`, {
      method: 'GET',
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
