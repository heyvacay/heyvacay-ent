import { NextResponse } from 'next/server';
import { STRIPE } from '@/lib/config.server';
import { stripeConfigured, ensureCustomer, createSetupIntent } from '@/lib/stripe.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Begin saving a company card: ensure a Stripe Customer for the company and
 * create a SetupIntent (usage=off_session). Returns the client secret for
 * Stripe Elements to confirm. When Stripe isn't configured (no secret key),
 * returns { configured: false } so the UI falls back to the demo card form.
 *
 * Body: { companyId, companyName?, email?, customerId? }
 */
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ configured: false });
  }
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty ok */
  }
  const companyId = String(body.companyId ?? '').trim();
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }
  try {
    const customerId = await ensureCustomer(companyId, {
      customerId: body.customerId ? String(body.customerId) : undefined,
      name: body.companyName ? String(body.companyName) : undefined,
      email: body.email ? String(body.email) : undefined,
    });
    const si = await createSetupIntent(customerId);
    return NextResponse.json({
      configured: true,
      clientSecret: si.client_secret,
      customerId,
      publishableKey: STRIPE.publishableKey,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
