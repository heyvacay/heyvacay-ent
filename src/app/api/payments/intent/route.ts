import { NextResponse } from 'next/server';
import { STRIPE } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create a Stripe PaymentIntent for a booking total. Uses the Stripe REST API
 * directly (no SDK) so the client can confirm it with Stripe Elements. Returns
 * { demo: true } when no Stripe key is configured so the UI falls back cleanly.
 */
export async function POST(req: Request) {
  let body: { amount?: number; currency?: string; description?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const amount = Math.round(Number(body.amount) || 0);
  if (amount <= 0) return NextResponse.json({ error: 'amount required' }, { status: 400 });

  if (!STRIPE.live) return NextResponse.json({ demo: true });

  try {
    const form = new URLSearchParams();
    form.set('amount', String(amount * 100)); // cents
    form.set('currency', (body.currency || 'usd').toLowerCase());
    form.set('automatic_payment_methods[enabled]', 'true');
    if (body.description) form.set('description', body.description);

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
