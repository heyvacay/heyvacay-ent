import { NextResponse } from 'next/server';
import { STRIPE } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create a Stripe PaymentIntent for a booking total.
 *
 * Preferred path: proxy the SAME HeyVacay backend the consumer site uses
 * (/bookings/payment/init-stripe), so payments run on the same Stripe account,
 * keys, and tracking tags — the enterprise app adds its own metadata so these
 * bookings are tagged as enterprise. Falls back to a direct Stripe PaymentIntent
 * if this app is given its own key, and finally to demo mode (no charge).
 */
export async function POST(req: Request) {
  let body: {
    amount?: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, string>;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const amount = Math.round(Number(body.amount) || 0);
  if (amount <= 0) return NextResponse.json({ error: 'amount required' }, { status: 400 });
  const currency = (body.currency || 'usd').toLowerCase();
  const metadata = {
    source: 'heyvacay-enterprise',
    product: 'corporate-travel',
    ...(body.metadata ?? {}),
  };

  // IMPORTANT: this generic intent must NEVER create a charge that isn't tied
  // to a locked supplier order. A real hotel/flight booking goes through the
  // order flow (prebook → /bookings/payment/init-stripe → confirm/capture) in
  // liveBooking.ts, which mints the PaymentIntent against the prebooked order so
  // money and the RateHawk/Duffel order are issued together. Here we only mint a
  // PaymentIntent when THIS app has its own Stripe key (standalone), otherwise
  // demo — so the "saved card" / no-order convenience path can't take real money
  // without a booking.
  if (!STRIPE.live) return NextResponse.json({ demo: true });

  try {
    const form = new URLSearchParams();
    form.set('amount', String(amount * 100)); // cents
    form.set('currency', (body.currency || 'usd').toLowerCase());
    form.set('automatic_payment_methods[enabled]', 'true');
    if (body.description) form.set('description', body.description);
    Object.entries(metadata).forEach(([k, v]) => form.set(`metadata[${k}]`, String(v)));

    const res = await fetch(`${STRIPE.base}/payment_intents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.client_secret) {
      return NextResponse.json({ clientSecret: data.client_secret });
    }
    return NextResponse.json({ error: data?.error?.message || 'Stripe error' }, { status: 502 });
  } catch {
    return NextResponse.json({ error: 'Stripe request failed' }, { status: 502 });
  }
}
