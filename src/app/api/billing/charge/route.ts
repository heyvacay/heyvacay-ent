import { NextResponse } from 'next/server';
import { stripeConfigured, chargeOffSession } from '@/lib/stripe.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Charge the saved company card off-session — e.g. auto-pay a booking on the
 * company card without prompting the traveler. Amount is in cents.
 *
 * Body: { customerId, paymentMethodId, amount, currency?, description?, companyId? }
 *
 * A card that requires authentication (SCA) throws; the message is returned so
 * the caller can ask the admin to re-authenticate the card.
 */
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 400 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const customerId = String(body.customerId ?? '').trim();
  const paymentMethodId = String(body.paymentMethodId ?? '').trim();
  const amount = Number(body.amount);
  if (!customerId || !paymentMethodId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'customerId, paymentMethodId and a positive amount are required.' },
      { status: 400 },
    );
  }
  try {
    const pi = await chargeOffSession({
      customerId,
      paymentMethodId,
      amountCents: amount,
      currency: body.currency ? String(body.currency) : 'usd',
      description: body.description ? String(body.description) : undefined,
      metadata: body.companyId ? { companyId: String(body.companyId) } : undefined,
    });
    return NextResponse.json({ ok: pi.status === 'succeeded', status: pi.status, id: pi.id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 402 });
  }
}
