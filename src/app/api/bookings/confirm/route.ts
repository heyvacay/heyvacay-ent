import { forwardBooking } from '@/lib/bookingProxy.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Hotel finish + capture — issue the reservation with the supplier (service-account authed proxy to the shared backend). */
export async function POST(req: Request) {
  return forwardBooking(req, '/bookings/confirm');
}
