import { NextResponse } from 'next/server';
import type { LatLng, RideProvider } from '@/lib/rideshare';
import { uberBook, uberDeepLink } from '@/lib/integrations/uber.server';
import { lyftBook, lyftDeepLink } from '@/lib/integrations/lyft.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rideshare/book
 *   { provider, classKey, productId?, fareId?, pickup, dropoff, passenger:{firstName?,phone,email?} }
 *
 * Attempts a real booking (Uber Guest Rides / Lyft Concierge). If the provider
 * key isn't connected yet, or programmatic booking access isn't granted, it
 * returns booked:false plus a deep link so the traveler can still complete the
 * ride in the provider app — the caller records the trip + routes for approval
 * either way.
 */
export async function POST(req: Request) {
  let b: {
    provider?: RideProvider;
    classKey?: string;
    productId?: string;
    fareId?: string;
    pickup?: LatLng;
    dropoff?: LatLng;
    passenger?: { firstName?: string; lastName?: string; phone?: string; email?: string };
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { provider, classKey, productId, fareId, pickup, dropoff, passenger } = b;
  if (!provider || !pickup?.lat || !dropoff?.lat) {
    return NextResponse.json({ error: 'provider, pickup and dropoff are required' }, { status: 400 });
  }
  const deepLink = provider === 'uber' ? uberDeepLink(pickup, dropoff) : lyftDeepLink(pickup, dropoff);

  // Phone is required for real booking; without it we go straight to deep link.
  if (!passenger?.phone) {
    return NextResponse.json({ booked: false, deepLink, reason: 'No passenger phone — use the app link.' });
  }

  try {
    if (provider === 'uber') {
      const r = await uberBook({ pickup, dropoff, productId, fareId, guest: { ...passenger, phone: passenger.phone } });
      return NextResponse.json({ booked: true, provider, id: r.id, status: r.status });
    }
    const r = await lyftBook({
      rideType: classKey || 'lyft',
      pickup,
      dropoff,
      passenger: { firstName: passenger.firstName, phone: passenger.phone },
    });
    return NextResponse.json({ booked: true, provider, id: r.id, status: r.status });
  } catch (e) {
    // Not live / no booking access / provider error → deep-link fallback.
    return NextResponse.json({
      booked: false,
      deepLink,
      reason: (e as Error)?.message?.includes('NOT_LIVE')
        ? 'Rideshare booking not connected yet — opening the app link.'
        : 'Could not auto-book — opening the app link.',
    });
  }
}
