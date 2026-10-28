import { NextResponse } from 'next/server';
import { STRIPE } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tells the client whether real Stripe payments are available and, if so, the
 * publishable key to initialise Stripe.js with. Read at runtime (not baked into
 * the bundle) so flipping the secret on in ECS enables live checkout instantly.
 */
export async function GET() {
  return NextResponse.json({
    live: STRIPE.live,
    publishableKey: STRIPE.live ? STRIPE.publishableKey : '',
  });
}
