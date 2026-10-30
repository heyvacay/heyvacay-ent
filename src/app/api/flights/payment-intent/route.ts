import { forwardBooking } from '@/lib/bookingProxy.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Flight payment init — Stripe PaymentIntent for the offer (service-account authed proxy to the shared backend). */
export async function POST(req: Request) {
  return forwardBooking(req, '/flights/stripe-payment-intent');
}
