import { forwardBooking } from '@/lib/bookingProxy.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Hotel booking form — payment types for the locked order (service-account authed proxy to the shared backend). */
export async function POST(req: Request) {
  return forwardBooking(req, '/bookings/form');
}
