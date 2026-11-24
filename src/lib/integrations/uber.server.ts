import 'server-only';

/**
 * Uber for Business — Guest Rides API client.
 *
 * Docs (gated to Uber for Business): base https://api.uber.com, OAuth2
 * client_credentials at https://auth.uber.com/oauth/v2/token (scope guests.trips).
 *   - Estimate products + upfront fare:  POST /v1/guests/trips/estimates
 *   - Book on behalf of a guest:         POST /v1/guests/trips
 *   - Trip status:                       GET  /v1/guests/trips/{request_id}
 *   - Cancel:                            POST /v1/guests/trips/{request_id}/cancel
 *
 * The exact JSON field names on the gated reference pages couldn't be fetched
 * from this environment, so the request/response MAPPING is isolated in the two
 * `map*` helpers below and written defensively (reads several likely field names).
 * When the real key is connected, confirm the fields against Uber's reference and
 * adjust only those helpers — the rest of the app is provider-agnostic.
 *
 * Not configured → every function throws `UBER_NOT_LIVE`, and callers fall back
 * to the fare model + an Uber deep link.
 */

import { UBER } from '@/lib/config.server';
import {
  RIDE_CATALOG,
  modelFare,
  milesApart,
  type LatLng,
  type RideOption,
  type RideTier,
} from '@/lib/rideshare';

export const UBER_NOT_LIVE = 'UBER_NOT_LIVE';

export function uberConfigured(): boolean {
  return UBER.configured;
}

/* ----------------------------- auth (cached) ----------------------------- */

let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (!UBER.configured) throw new Error(UBER_NOT_LIVE);
  const now = Date.now();
  if (tokenCache && tokenCache.exp > now + 30_000) return tokenCache.token;
  const body = new URLSearchParams({
    client_id: UBER.clientId,
    client_secret: UBER.clientSecret,
    grant_type: 'client_credentials',
    scope: UBER.scope,
  });
  const res = await fetch(UBER.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Uber token failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  tokenCache = { token: json.access_token, exp: now + (json.expires_in ?? 2592000) * 1000 };
  return json.access_token;
}

async function uberFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${UBER.base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en_US',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Uber ${path} ${res.status}: ${text.slice(0, 200)}`);
  return data as T;
}

/* ------------------------------- mapping -------------------------------- */

/** Best-effort tier from an Uber product display name. */
function uberTier(name: string): RideTier {
  const n = name.toLowerCase();
  if (n.includes('black')) return 'luxury';
  if (n.includes('suv') || n.includes('xl')) return 'xl';
  if (n.includes('comfort') || n.includes('premier')) return 'premium';
  return 'standard';
}

/** Match a live product to our catalog key, else synthesize one from the name. */
function uberClassKey(name: string): string {
  const hit = RIDE_CATALOG.uber.find((c) => name.toLowerCase().includes(c.label.toLowerCase().replace('uber ', '')));
  return hit?.key ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/* ------------------------------- public --------------------------------- */

/** Live ride options + upfront fares between two points. Throws UBER_NOT_LIVE. */
export async function uberEstimate(pickup: LatLng, dropoff: LatLng): Promise<RideOption[]> {
  if (!UBER.configured) throw new Error(UBER_NOT_LIVE);
  // POST /v1/guests/trips/estimates — body carries pickup/dropoff lat/lng.
  const data = await uberFetch<{ estimates?: unknown[]; products?: unknown[] }>(
    '/v1/guests/trips/estimates',
    {
      method: 'POST',
      body: JSON.stringify({
        pickup: { latitude: pickup.lat, longitude: pickup.lng },
        dropoff: { latitude: dropoff.lat, longitude: dropoff.lng },
      }),
    }
  );
  const rows = (data.estimates ?? data.products ?? []) as Array<Record<string, unknown>>;
  return rows.map((r) => {
    const name = String(r.display_name ?? r.localized_display_name ?? r.product ?? 'Uber');
    const fare = (r.fare ?? r.estimate ?? {}) as Record<string, unknown>;
    const value = Number(fare.value ?? fare.total ?? r.value ?? 0) || undefined;
    return {
      provider: 'uber' as const,
      classKey: uberClassKey(name),
      label: name,
      tier: uberTier(name),
      seats: /suv|xl/i.test(name) ? 6 : 4,
      etaMinutes:
        r.pickup_estimate != null ? Number(r.pickup_estimate) : undefined,
      fareLow: value,
      fareHigh: value,
      currency: String(fare.currency_code ?? fare.currency ?? 'USD'),
      fareId: fare.fare_id != null ? String(fare.fare_id) : r.fare_id != null ? String(r.fare_id) : undefined,
      productId: r.product_id != null ? String(r.product_id) : undefined,
      live: true,
    };
  });
}

/** Book a Guest Trip. Returns the provider request id + status. Throws on any
 *  failure (incl. UBER_NOT_LIVE or missing booking access) so the caller can
 *  fall back to a deep link. */
export async function uberBook(args: {
  pickup: LatLng;
  dropoff: LatLng;
  productId?: string;
  fareId?: string;
  guest: { firstName?: string; lastName?: string; phone: string; email?: string };
}): Promise<{ id: string; status: string }> {
  if (!UBER.configured) throw new Error(UBER_NOT_LIVE);
  const data = await uberFetch<Record<string, unknown>>('/v1/guests/trips', {
    method: 'POST',
    body: JSON.stringify({
      guest: {
        phone_number: args.guest.phone,
        first_name: args.guest.firstName,
        last_name: args.guest.lastName,
        email: args.guest.email,
      },
      pickup: { latitude: args.pickup.lat, longitude: args.pickup.lng },
      dropoff: { latitude: args.dropoff.lat, longitude: args.dropoff.lng },
      product_id: args.productId,
      fare_id: args.fareId,
    }),
  });
  return {
    id: String(data.request_id ?? data.trip_id ?? data.id ?? ''),
    status: String(data.status ?? 'processing'),
  };
}

export async function uberTripStatus(id: string): Promise<{ status: string }> {
  const data = await uberFetch<Record<string, unknown>>(`/v1/guests/trips/${encodeURIComponent(id)}`);
  return { status: String(data.status ?? 'unknown') };
}

export async function uberCancel(id: string): Promise<void> {
  await uberFetch(`/v1/guests/trips/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

/* ----------------------------- model + link ----------------------------- */

/** Modeled options (no live key) — one per catalog class, fare from the model. */
export function uberModelOptions(pickup: LatLng, dropoff: LatLng): RideOption[] {
  const miles = milesApart(pickup, dropoff);
  return RIDE_CATALOG.uber.map((c) => {
    const fare = modelFare(c.tier, miles);
    return {
      provider: 'uber' as const,
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

/** Rider deep link used when programmatic booking isn't available yet. */
export function uberDeepLink(pickup: LatLng, dropoff: LatLng): string {
  const q = new URLSearchParams({
    action: 'setPickup',
    'pickup[latitude]': String(pickup.lat),
    'pickup[longitude]': String(pickup.lng),
    'dropoff[latitude]': String(dropoff.lat),
    'dropoff[longitude]': String(dropoff.lng),
  });
  return `https://m.uber.com/ul/?${q.toString()}`;
}
