'use client';

/** Client wrappers for the rideshare API (options / book / status / cancel). */

import type { LatLng, RideOption, RideProvider } from '@/lib/rideshare';

export async function fetchRideOptions(
  pickup: LatLng,
  dropoff: LatLng,
  provider?: RideProvider
): Promise<RideOption[]> {
  try {
    const res = await fetch('/api/rideshare/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickup, dropoff, provider }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { options?: RideOption[] };
    return json.options ?? [];
  } catch {
    return [];
  }
}

export interface BookRideResult {
  booked: boolean;
  provider?: RideProvider;
  id?: string;
  status?: string;
  deepLink?: string;
  reason?: string;
}

export async function bookRideApi(args: {
  provider: RideProvider;
  classKey: string;
  productId?: string;
  fareId?: string;
  pickup: LatLng;
  dropoff: LatLng;
  passenger: { firstName?: string; lastName?: string; phone?: string; email?: string };
}): Promise<BookRideResult> {
  try {
    const res = await fetch('/api/rideshare/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return (await res.json()) as BookRideResult;
  } catch {
    return { booked: false, reason: 'Network error' };
  }
}
