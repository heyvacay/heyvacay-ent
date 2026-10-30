import { forwardBooking } from '@/lib/bookingProxy.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Hotel prebook — lock the room and re-price before payment (service-account authed proxy to the shared backend). */
export async function POST(req: Request) {
  return forwardBooking(req, '/bookings/prebook');
}
