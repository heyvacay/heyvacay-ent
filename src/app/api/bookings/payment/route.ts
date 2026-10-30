import { forwardBooking } from '@/lib/bookingProxy.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Hotel payment init — Stripe PaymentIntent for the order (manual capture) (service-account authed proxy to the shared backend). */
export async function POST(req: Request) {
  return forwardBooking(req, '/bookings/payment/init-stripe');
}
