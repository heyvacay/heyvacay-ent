import 'server-only';

/**
 * Lyft Business — Concierge API client (request rides for a passenger by phone).
 *
 * Docs (Lyft Business): base https://api.lyft.com/v1, OAuth2 two-legged
 * (client_credentials) at https://api.lyft.com/oauth/token with HTTP Basic
 * (client_id:client_secret) and scope rides.request.
 *   - Cost estimate:   GET  /cost?start_lat&start_lng&end_lat&end_lng
 *   - Ride types:      GET  /ridetypes?lat&lng
 *   - Create (behalf): POST /concierge/rides   { ride_type, origin, destination, passenger }
 *   - Status:          GET  /rides/{id}
 *   - Cancel:          POST /rides/{id}/cancel
 *
 * As with Uber, the exact field names on the gated docs couldn't be fetched here,
 * so response mapping is isolated and defensive — confirm against Lyft's reference
 * once the key is connected. Not configured → throws LYFT_NOT_LIVE and callers
 * fall back to the fare model + a Lyft deep link.
 */

import { LYFT } from '@/lib/config.server';
import {
  RIDE_CATALOG,
  modelFare,
  milesApart,
  findRideClass,
  type LatLng,
  type RideOption,
  type RideTier,
} from '@/lib/rideshare';

export const LYFT_NOT_LIVE = 'LYFT_NOT_LIVE';

export function lyftConfigured(): boolean {
  return LYFT.configured;
}

/* ----------------------------- auth (cached) ----------------------------- */

let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (!LYFT.configured) throw new Error(LYFT_NOT_LIVE);
  const now = Date.now();
  if (tokenCache && tokenCache.exp > now + 30_000) return tokenCache.token;
  const basic = Buffer.from(`${LYFT.clientId}:${LYFT.clientSecret}`).toString('base64');
  const res = await fetch(LYFT.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: LYFT.scope }),
  });
  if (!res.ok) throw new Error(`Lyft token failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = { token: json.access_token, exp: now + (json.expires_in ?? 86400) * 1000 };
  return json.access_token;
}

async function lyftFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${LYFT.base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Lyft ${path} ${res.status}: ${text.slice(0, 200)}`);
  return data as T;
}

function lyftTier(rideType: string): RideTier {
  return findRideClass('lyft', rideType)?.tier ?? 'standard';
}

/* ------------------------------- public --------------------------------- */

export async function lyftEstimate(pickup: LatLng, dropoff: LatLng): Promise<RideOption[]> {
  if (!LYFT.configured) throw new Error(LYFT_NOT_LIVE);
  const q = new URLSearchParams({
    start_lat: String(pickup.lat),
    start_lng: String(pickup.lng),
    end_lat: String(dropoff.lat),
    end_lng: String(dropoff.lng),
  });
  const data = await lyftFetch<{ cost_estimates?: Array<Record<string, unknown>> }>(`/cost?${q}`);
  const rows = data.cost_estimates ?? [];
  return rows.map((r) => {
    const rideType = String(r.ride_type ?? 'lyft');
    const min = Number(r.estimated_cost_cents_min ?? 0) / 100 || undefined;
    const max = Number(r.estimated_cost_cents_max ?? 0) / 100 || undefined;
    const cat = findRideClass('lyft', rideType);
    return {
      provider: 'lyft' as const,
      classKey: rideType,
      label: String(r.display_name ?? cat?.label ?? rideType),
      tier: lyftTier(rideType),
      seats: cat?.seats ?? 4,
      etaMinutes: r.estimated_duration_seconds != null ? Math.round(Number(r.estimated_duration_seconds) / 60) : undefined,
      fareLow: min,
      fareHigh: max,
      currency: String(r.currency ?? 'USD'),
      live: true,
    };
  });
}

export async function lyftBook(args: {
  rideType: string;
  pickup: LatLng;
  dropoff: LatLng;
  passenger: { firstName?: string; phone: string };
}): Promise<{ id: string; status: string }> {
  if (!LYFT.configured) throw new Error(LYFT_NOT_LIVE);
  const data = await lyftFetch<Record<string, unknown>>('/concierge/rides', {
    method: 'POST',
    body: JSON.stringify({
      ride_type: args.rideType,
      origin: { lat: args.pickup.lat, lng: args.pickup.lng, address: args.pickup.label },
      destination: { lat: args.dropoff.lat, lng: args.dropoff.lng, address: args.dropoff.label },
      passenger: { first_name: args.passenger.firstName, phone_number: args.passenger.phone },
    }),
  });
  return {
    id: String(data.ride_id ?? data.id ?? ''),
    status: String(data.status ?? 'pending'),
  };
}

export async function lyftRideStatus(id: string): Promise<{ status: string }> {
  const data = await lyftFetch<Record<string, unknown>>(`/rides/${encodeURIComponent(id)}`);
  return { status: String(data.status ?? 'unknown') };
}

export async function lyftCancel(id: string): Promise<void> {
  await lyftFetch(`/rides/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

/* ----------------------------- model + link ----------------------------- */

export function lyftModelOptions(pickup: LatLng, dropoff: LatLng): RideOption[] {
  const miles = milesApart(pickup, dropoff);
  return RIDE_CATALOG.lyft.map((c) => {
    const fare = modelFare(c.tier, miles);
    return {
      provider: 'lyft' as const,
      classKey: c.key,
      label: c.label,
      tier: c.tier,
      seats: c.seats,
      etaMinutes: 4,
      fareLow: Math.round(fare * 0.9),
      fareHigh: Math.round(fare * 1.15),
      currency: 'USD',
      live: false,
    };
  });
}

export function lyftDeepLink(pickup: LatLng, dropoff: LatLng): string {
  const q = new URLSearchParams({
    id: 'lyft',
    pickup: `${pickup.lat},${pickup.lng}`,
    destination: `${dropoff.lat},${dropoff.lng}`,
  });
  return `https://ride.lyft.com/?${q.toString()}`;
}
