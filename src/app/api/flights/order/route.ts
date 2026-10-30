import { forwardBooking } from '@/lib/bookingProxy.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Flight order — issue the Duffel ticket with passengers + payment (service-account authed proxy to the shared backend). */
export async function POST(req: Request) {
  return forwardBooking(req, '/flights/orders');
}
