import { NextResponse } from 'next/server';
import { STRIPE } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Issue a REAL Stripe refund against a booking's PaymentIntent — full, or
 * partial when `amount` (major units) is given. Used on cancellation so the
 * money actually goes back on the card, not just on screen.
 *
 * This is the enterprise-side refund path. For a live booking the backend's
 * /bookings/cancel already refunds against the order's PaymentIntent; the
 * caller only invokes this when that cancel did NOT return a refund, so we
 * never double-refund. The idempotency key (per PaymentIntent) is a second
 * guard: Stripe collapses repeated refund attempts for the same intent.
 */
export async function POST(req: Request) {
  let body: { paymentIntentId?: string; amount?: number; reason?: string; bookingRef?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const paymentIntentId = body.paymentIntentId?.trim();
  if (!paymentIntentId) {
    return NextResponse.json({ error: 'paymentIntentId is required.' }, { status: 400 });
  }
  if (!STRIPE.secretKey) {
    // No enterprise Stripe secret → we can't issue the refund here. The backend
    // cancel is expected to have refunded against the order's PaymentIntent.
    return NextResponse.json(
      { error: 'refund_not_configured', message: 'No Stripe secret key set for direct refunds.' },
      { status: 501 }
    );
  }

  const form = new URLSearchParams();
  form.set('payment_intent', paymentIntentId);
  // Partial refund when a positive amount under the full charge is given.
  if (typeof body.amount === 'number' && body.amount > 0) {
    form.set('amount', String(Math.round(body.amount * 100))); // cents
  }
  if (body.reason && ['duplicate', 'fraudulent', 'requested_by_customer'].includes(body.reason)) {
    form.set('reason', body.reason);
  } else {
    form.set('reason', 'requested_by_customer');
  }
  form.set('metadata[source]', 'heyvacay-enterprise');
  if (body.bookingRef) form.set('metadata[bookingRef]', body.bookingRef);

  try {
    const res = await fetch(`${STRIPE.base}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // One refund per PaymentIntent attempt — repeated calls return the same
        // refund instead of charging a second one back.
        'Idempotency-Key': `refund_${paymentIntentId}`,
      },
      body: form.toString(),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.id) {
      return NextResponse.json({
        refundId: data.id,
        amount: typeof data.amount === 'number' ? data.amount / 100 : undefined,
        status: data.status,
        source: 'stripe',
      });
    }
    return NextResponse.json(
      { error: data?.error?.message || 'Stripe refund failed.' },
      { status: 502 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: 'stripe_unreachable', message: (e as Error).message },
      { status: 502 }
    );
  }
}
