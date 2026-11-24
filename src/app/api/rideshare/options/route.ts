import { NextResponse } from 'next/server';
import type { LatLng, RideOption, RideProvider } from '@/lib/rideshare';
import {
  uberEstimate,
  uberModelOptions,
  uberConfigured,
} from '@/lib/integrations/uber.server';
import {
  lyftEstimate,
  lyftModelOptions,
  lyftConfigured,
} from '@/lib/integrations/lyft.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rideshare/options { pickup, dropoff, provider? }
 * Returns merged ride options across Uber + Lyft. Live fares when the provider
 * key is configured; otherwise the transparent fare model. Policy is applied on
 * the client (where company/event ride policy lives).
 */
export async function POST(req: Request) {
  let body: { pickup?: LatLng; dropoff?: LatLng; provider?: RideProvider };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { pickup, dropoff, provider } = body;
  if (!pickup?.lat || !dropoff?.lat) {
    return NextResponse.json({ error: 'pickup and dropoff (lat/lng) are required' }, { status: 400 });
  }
  const providers: RideProvider[] = provider ? [provider] : ['uber', 'lyft'];
  const options: RideOption[] = [];

  for (const p of providers) {
    try {
      if (p === 'uber') {
        const rows = uberConfigured() ? await uberEstimate(pickup, dropoff) : uberModelOptions(pickup, dropoff);
        options.push(...rows);
      } else {
        const rows = lyftConfigured() ? await lyftEstimate(pickup, dropoff) : lyftModelOptions(pickup, dropoff);
        options.push(...rows);
      }
    } catch {
      // Live call failed (not live, or provider error) → fall back to the model.
      options.push(...(p === 'uber' ? uberModelOptions(pickup, dropoff) : lyftModelOptions(pickup, dropoff)));
    }
  }

  return NextResponse.json({ options });
}
