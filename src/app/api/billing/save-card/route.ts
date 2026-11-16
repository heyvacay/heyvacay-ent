import { NextResponse } from 'next/server';
import {
  stripeConfigured,
  getSetupIntent,
  getPaymentMethod,
  setDefaultPaymentMethod,
} from '@/lib/stripe.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Finish saving a company card after Stripe Elements confirms the SetupIntent.
 * Reads the attached payment method, makes it the customer's default, and
 * returns the non-secret card details for the workspace to store.
 *
 * Body: { setupIntentId, customerId }
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
  const setupIntentId = String(body.setupIntentId ?? '').trim();
  const customerId = String(body.customerId ?? '').trim();
  if (!setupIntentId || !customerId) {
    return NextResponse.json({ error: 'setupIntentId and customerId are required.' }, { status: 400 });
  }
  try {
    const si = await getSetupIntent(setupIntentId);
    const pmId = typeof si.payment_method === 'string' ? si.payment_method : null;
    if (si.status !== 'succeeded' || !pmId) {
      return NextResponse.json({ error: 'The card was not saved. Please try again.' }, { status: 400 });
    }
    const pm = await getPaymentMethod(pmId);
    await setDefaultPaymentMethod(customerId, pmId);
    return NextResponse.json({
      card: {
        customerId,
        paymentMethodId: pmId,
        brand: pm.card?.brand || 'card',
        last4: pm.card?.last4 || '',
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        savedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
