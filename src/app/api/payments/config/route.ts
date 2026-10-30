import { NextResponse } from 'next/server';
import { STRIPE, isLiveBooking } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tells the client whether real Stripe payments are available and, if so, the
 * publishable key to initialise Stripe.js with. Read at runtime (not baked into
 * the bundle) so flipping the secret on in ECS enables live checkout instantly.
 */
export async function GET() {
  // A publishable key is enough to mount Stripe Elements — the secret can live
  // in our backend (same account/keys as heyvacay.co), which the intent route
  // proxies to. So "live" tracks the publishable key, not the local secret.
  const publishableKey = STRIPE.publishableKey;
  return NextResponse.json({
    live: Boolean(publishableKey),
    publishableKey,
    // Whether the service account is wired so real supplier orders can be
    // issued. The checkout runs the real prebook→pay→finish flow when true,
    // and records the trip in the workspace (no supplier order) when false.
    liveBooking: isLiveBooking(),
  });
}
