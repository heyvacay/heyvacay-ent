import { forwardBooking } from '@/lib/bookingProxy.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Hotel cancellation — cancel the supplier order + refund (service-account authed proxy). */
export async function POST(req: Request) {
  return forwardBooking(req, '/bookings/cancel');
}
