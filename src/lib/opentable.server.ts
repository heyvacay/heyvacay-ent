/**
 * OpenTable partner client (server-only).
 *
 * Implements the real OpenTable Partner API as documented in their developer
 * portal / Postman collection:
 *
 *   1. OAuth2 client-credentials
 *        GET  https://oauth.opentable.com/api/v2/oauth/token?grant_type=client_credentials
 *        Header: Authorization: Basic base64(client_id:client_secret)
 *        -> { access_token, token_type: "Bearer", scope, expires_in }
 *      The access token is reused until a minute before it expires.
 *
 *   2. Directory API (Bronze)
 *        GET  https://platform.opentable.com/sync/directory?limit=&offset=
 *        -> { total_items, offset, limit, items: [ { rid, name, address, city,
 *             state, country, latitude, longitude, phone_number, metro_name,
 *             aggregate_score, price_quartile, review_count, category[],
 *             profile_photo: { sizes: { medium: { url } } }, reservation_url } ] }
 *      There is no server-side city filter, so we lazily page the directory into
 *      an in-memory cache (per container) and filter locally. We cap how much we
 *      pull so a live search never fans out into hundreds of calls; anything we
 *      can't cover falls back to the built-in mock directory at the route level.
 *
 *   3. Single-search availability
 *        GET  https://platform.opentable.com/v2/availability/{rid}
 *               ?start_date_time=YYYY-MM-DDThh:mm&forward_minutes=&backward_minutes=
 *               &party_size=
 *        -> { rid, party_size, times_available: [ { time, availability_types:[
 *             { type, diningArea:[{ booking_url, id }] } ] } ], ... }
 *
 *   4. Booking (2-step)
 *        POST https://platform.opentable.com/v2/booking/{rid}/slot_locks
 *               { party_size, date_time, reservation_attribute:"default" }
 *          -> { reservation_token, expires_at, payment_method }
 *        POST https://platform.opentable.com/v2/booking/{rid}/reservations
 *               { reservation_token, first_name, last_name, email_address,
 *                 phone:{ number, country_code, phone_type }, reservation_attribute }
 *          -> { confirmation_number, date_time, party_size, manage_reservation_url }
 *
 * Credentials come from the ECS task (Secrets Manager); nothing here ever runs
 * in the browser. When credentials are absent, OPENTABLE.live is false and the
 * routes don't call any of this — they serve the mock directory instead.
 */

import { OPENTABLE } from './config.server';

/* ------------------------------------------------------------------ OAuth -- */

const OAUTH_URL =
  process.env.OPENTABLE_OAUTH_URL?.replace(/\/+$/, '') ||
  'https://oauth.opentable.com';

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Fetch (and cache) a client-credentials access token. Returns null when
 * credentials aren't configured or the token endpoint rejects us — callers
 * treat null as "fall back to mock".
 */
export async function getAccessToken(): Promise<string | null> {
  // Some partners get a single API key instead of a client id/secret pair.
  // If only an API key is present, use it directly as the bearer.
  if (!OPENTABLE.clientId || !OPENTABLE.clientSecret) {
    return OPENTABLE.apiKey || null;
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(
    `${OPENTABLE.clientId}:${OPENTABLE.clientSecret}`
  ).toString('base64');

  try {
    const res = await fetch(
      `${OAUTH_URL}/api/v2/oauth/token?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | { access_token?: string; expires_in?: number }
      | null;
    if (!data?.access_token) return null;
    const ttlMs = (Number(data.expires_in) || 3600) * 1000;
    cachedToken = { value: data.access_token, expiresAt: now + ttlMs };
    return cachedToken.value;
  } catch {
    return null;
  }
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

/* -------------------------------------------------------------- Directory -- */

export interface OtRestaurant {
  id: string;
  name: string;
  cuisine: string;
  genre: string;
  priceBand: number;
  rating: number;
  city: string;
  neighborhood: string;
  image: string;
}

interface DirectoryItem {
  rid?: number | string;
  restaurant_id?: number | string;
  name?: string;
  city?: string;
  state?: string;
  metro_name?: string;
  neighborhood_name?: string;
  aggregate_score?: string | number;
  price_quartile?: string;
  category?: string[];
  profile_photo?: { sizes?: Record<string, { url?: string }> };
  reservation_url?: string;
}

// Our normalized food genres (match the mock so voting/filtering is uniform).
const GENRE_MAP: Record<string, string> = {
  japanese: 'Japanese',
  sushi: 'Japanese',
  ramen: 'Japanese',
  italian: 'Italian',
  pizza: 'Italian',
  mexican: 'Mexican',
  steak: 'Steakhouse',
  steakhouse: 'Steakhouse',
  chinese: 'Chinese',
  indian: 'Indian',
  french: 'French',
  mediterranean: 'Mediterranean',
  spanish: 'Mediterranean',
  greek: 'Mediterranean',
  barbecue: 'BBQ',
  bbq: 'BBQ',
  vegetarian: 'Vegetarian',
  vegan: 'Vegetarian',
};

function normalizeGenre(categories: string[] | undefined): string {
  for (const c of categories || []) {
    const key = c.toLowerCase();
    for (const [needle, genre] of Object.entries(GENRE_MAP)) {
      if (key.includes(needle)) return genre;
    }
  }
  return (categories && categories[0]) || 'Restaurant';
}

function mapDirectoryItem(it: DirectoryItem): OtRestaurant | null {
  const id = it.rid ?? it.restaurant_id;
  if (id == null || !it.name) return null;
  const priceBand = typeof it.price_quartile === 'string'
    ? Math.max(1, Math.min(4, it.price_quartile.length))
    : 2;
  const rating = Number(it.aggregate_score) || 0;
  const image =
    it.profile_photo?.sizes?.medium?.url ||
    it.profile_photo?.sizes?.large?.url ||
    it.profile_photo?.sizes?.small?.url ||
    '';
  return {
    id: String(id),
    name: it.name,
    cuisine: (it.category || []).join(' · ') || 'Restaurant',
    genre: normalizeGenre(it.category),
    priceBand,
    rating,
    city: it.city || '',
    neighborhood: it.neighborhood_name || it.metro_name || it.city || '',
    image,
  };
}

/**
 * The Directory API has no city filter, so we lazily page it into an in-memory
 * cache and filter locally. The cache is per-container and TTL'd; we cap the
 * number of pages so a cold search costs a bounded number of upstream calls.
 */
const DIR_REQ_LIMIT = 1000; // ask for big pages; we use the server's real size
const DIR_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const DIR_MAX_PAGES = 800; // safety cap
const DIR_CONCURRENCY = 16; // parallel page fetches
const DIR_WAIT_MS = 9000; // max a search waits on a cold cache before serving partial

// Progressive cache: `items` grows as pages stream in; `complete` flips true
// when the whole directory is loaded. A search serves whatever's loaded so far
// (bounded wait), and the background load keeps filling it for the next search.
const dir: {
  items: OtRestaurant[];
  loadedAt: number;
  complete: boolean;
  loading: boolean;
} = { items: [], loadedAt: 0, complete: false, loading: false };

async function fetchDirPage(
  headers: Record<string, string>,
  limit: number,
  offset: number
): Promise<{ items: DirectoryItem[]; total: number } | null> {
  try {
    const res = await fetch(
      `${OPENTABLE.base}/sync/directory?limit=${limit}&offset=${offset}`,
      { headers, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | { items?: DirectoryItem[]; total_items?: number }
      | null;
    return { items: data?.items || [], total: Number(data?.total_items) || 0 };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Kick off a full directory load in the BACKGROUND (non-blocking). Streams
 * mapped venues into `dir.items` as pages arrive (parallel worker pool) so a
 * concurrent search can serve partial results immediately. Idempotent: no-op
 * while a load is running or while the cache is still fresh and complete.
 */
function warmDirectory(): void {
  const fresh = dir.complete && Date.now() - dir.loadedAt < DIR_TTL_MS;
  if (dir.loading || fresh) return;
  dir.loading = true;

  void (async () => {
    const headers = await authHeaders();
    if (!headers) {
      dir.loading = false;
      return;
    }
    const acc: OtRestaurant[] = [];
    try {
      // Page 0 — establishes the effective page size and total count, and makes
      // first results available right away.
      const first = await fetchDirPage(headers, DIR_REQ_LIMIT, 0);
      if (!first || first.items.length === 0) return;
      const pageSize = first.items.length;
      const total = first.total || pageSize;
      const pages = Math.min(DIR_MAX_PAGES, Math.ceil(total / pageSize));
      for (const it of first.items) {
        const m = mapDirectoryItem(it);
        if (m) acc.push(m);
      }
      dir.items = acc; // publish (same ref; grows as we push)
      dir.loadedAt = Date.now();
      dir.complete = pages <= 1;

      // Worker pool over the remaining offsets.
      const offsets: number[] = [];
      for (let p = 1; p < pages; p++) offsets.push(p * pageSize);
      let idx = 0;
      const worker = async () => {
        while (idx < offsets.length) {
          const off = offsets[idx++];
          const r = await fetchDirPage(headers, pageSize, off);
          if (r) {
            for (const it of r.items) {
              const m = mapDirectoryItem(it);
              if (m) acc.push(m);
            }
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(DIR_CONCURRENCY, offsets.length || 1) }, () => worker())
      );
      dir.loadedAt = Date.now();
      dir.complete = true;
    } finally {
      dir.loading = false;
    }
  })();
}

/** Trigger a background warm without waiting (called when the Dining page opens). */
export function primeDirectory(): void {
  warmDirectory();
}

/**
 * Return the cached directory, serving partial results on a cold cache rather
 * than blocking on the full ~60k load. Starts the background warm, waits up to
 * DIR_WAIT_MS for enough to be useful, then returns whatever's loaded.
 */
async function loadDirectory(): Promise<OtRestaurant[]> {
  const fresh = dir.complete && Date.now() - dir.loadedAt < DIR_TTL_MS;
  if (fresh) return dir.items;
  warmDirectory();
  const deadline = Date.now() + DIR_WAIT_MS;
  // Serve complete results if the load finishes within the budget; otherwise
  // return whatever has streamed in so far (the next search gets more).
  while (!dir.complete && Date.now() < deadline) {
    await sleep(150);
  }
  return dir.items;
}

/**
 * Live directory search. Filters the cached full directory by city, genre, and
 * an optional free-text name/cuisine query. Returns [] when credentials are
 * missing/unreachable or nothing matches — the route then falls back to mock.
 */
export async function searchDirectory(
  city?: string,
  genre?: string,
  nameQuery?: string
): Promise<OtRestaurant[]> {
  const all = await loadDirectory();
  if (!all.length) return [];
  const c = (city || '').trim().toLowerCase();
  const q = (nameQuery || '').trim().toLowerCase();
  return all.filter((r) => {
    const cityOk =
      !c ||
      r.city.toLowerCase().includes(c) ||
      c.includes(r.city.toLowerCase()) ||
      r.neighborhood.toLowerCase().includes(c);
    const genreOk = !genre || r.genre === genre;
    const nameOk =
      !q || r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q);
    return cityOk && genreOk && nameOk;
  });
}

/** Expose the raw cached directory size (diagnostics). */
export async function directoryStats(): Promise<{ cached: number }> {
  const all = await loadDirectory();
  return { cached: all.length };
}

/* ------------------------------------------------------------ Availability -- */

export interface OtAvailability {
  restaurantId: string;
  date: string;
  partySize: number;
  requestedTime: string;
  requestedAvailable: boolean;
  slots: { time: string; available: boolean; bookingUrl?: string }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Extract bookable HH:mm slot times from whatever shape the availability
 * response uses. OpenTable's live response doesn't always match a single
 * documented shape, so we try the known containers in order and, as a last
 * resort, deep-scan for any ISO date-times on the requested date.
 */
function extractSlots(
  data: unknown,
  date: string
): { time: string; bookingUrl?: string }[] {
  const out: { time: string; bookingUrl?: string }[] = [];
  const seen = new Set<string>();
  const push = (iso: unknown, bookingUrl?: string) => {
    if (typeof iso !== 'string') return;
    if (!iso.includes(date)) return; // only the requested date
    const m = iso.match(/T(\d{2}:\d{2})/);
    if (!m || seen.has(m[1])) return;
    seen.add(m[1]);
    out.push({ time: m[1], bookingUrl });
  };
  const d = data as Record<string, any>;

  // 1) times_available: [{ time, availability_types:[{ diningArea:[{booking_url}] }] }]
  if (Array.isArray(d?.times_available)) {
    for (const t of d.times_available) {
      const bu = t?.availability_types?.[0]?.diningArea?.[0]?.booking_url;
      push(t?.time ?? t?.date_time, bu);
    }
  }
  // 2) times: [iso…] or [{ time|date_time, booking_url }]
  if (!out.length && Array.isArray(d?.times)) {
    for (const t of d.times) {
      if (typeof t === 'string') push(t);
      else push(t?.date_time ?? t?.time ?? t?.datetime, t?.booking_url);
    }
  }
  // 3) slots / availability / available_times arrays
  for (const key of ['slots', 'availability', 'available_times', 'availabilities']) {
    if (!out.length && Array.isArray(d?.[key])) {
      for (const t of d[key]) {
        if (typeof t === 'string') push(t);
        else push(t?.date_time ?? t?.time ?? t?.datetime, t?.booking_url);
      }
    }
  }
  // 4) last resort: deep-scan for any YYYY-MM-DDThh:mm on the requested date.
  if (!out.length) {
    const scan = (v: unknown) => {
      if (typeof v === 'string') push(v);
      else if (Array.isArray(v)) v.forEach(scan);
      else if (v && typeof v === 'object') Object.values(v).forEach(scan);
    };
    scan(data);
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/** Build the availability request URL for a restaurant/date/time/party. */
function availabilityUrl(args: {
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
}): string {
  const startDateTime = `${args.date}T${args.time}`;
  return (
    `${OPENTABLE.base}/v2/availability/${encodeURIComponent(args.restaurantId)}` +
    `?start_date_time=${encodeURIComponent(startDateTime)}` +
    `&backward_minutes=150&forward_minutes=150` +
    `&party_size=${args.partySize}`
  );
}

/** Raw upstream availability JSON (diagnostics only). */
export async function getAvailabilityRaw(args: {
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
}): Promise<{ status: number; url: string; body: unknown } | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const url = availabilityUrl(args);
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    const body = await res.json().catch(() => null);
    return { status: res.status, url, body };
  } catch (e) {
    return { status: 0, url, body: { error: String(e) } };
  }
}

/**
 * Single-search availability for one restaurant. We ask OpenTable for a window
 * around the requested time (±120 min) so that, when the exact time is taken,
 * we can still surface the nearest bookable slots.
 */
export async function getAvailability(args: {
  restaurantId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  partySize: number;
}): Promise<OtAvailability | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  const url = availabilityUrl(args);

  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data) return null;

    const found = extractSlots(data, args.date);
    const slots = found.map((f) => ({ time: f.time, available: true, bookingUrl: f.bookingUrl }));

    const requestedAvailable = slots.some((s) => s.time === args.time);
    return {
      restaurantId: args.restaurantId,
      date: args.date,
      partySize: args.partySize,
      requestedTime: args.time,
      requestedAvailable,
      // Exclude the exact requested time from the "alternatives" list.
      slots: slots.filter((s) => s.time !== args.time).slice(0, 8),
    };
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- Booking -- */

export interface OtReservation {
  confirmation: string;
  manageUrl?: string;
  status: string;
}

/**
 * Best-effort cancellation. The confirmed cancel path on OpenTable is the
 * guest's manage_reservation_url; this attempts the partner cancel endpoint so
 * an in-app cancel works when available, and reports failure so the UI can fall
 * back to the manage link.
 */
export async function cancelReservation(args: {
  restaurantId: string;
  confirmation: string;
}): Promise<{ ok: boolean; status: number }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, status: 0 };
  const url =
    `${OPENTABLE.base}/v2/booking/${encodeURIComponent(args.restaurantId)}` +
    `/reservations/${encodeURIComponent(args.confirmation)}/cancel`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] || 'HeyVacay', last: 'Guest' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/**
/**
 * Max length for the OpenTable `special_request` note. Kept conservative so a
 * long guest request never makes OpenTable reject the reservation; tunable via
 * env if the account allows more.
 */
const OT_NOTE_MAX = Number(process.env.OPENTABLE_NOTE_MAX || '500');

/**
 * Build the note sent to the restaurant on every HeyVacay Enterprise booking.
 * Always present (even with no guest request) so the restaurant knows it's a
 * HeyVacay / OpenTable Premier Partner reservation. When a guest request is
 * given it's embedded verbatim, truncated only if needed to keep the whole note
 * under OT_NOTE_MAX while preserving the surrounding framing.
 */
export function formatReservationNote(specialRequest?: string): string {
  const header = 'HEYVACAY ENTERPRISE RESERVATION';
  const req = (specialRequest || '').trim();

  if (!req) {
    const note = `${header}\nThis reservation was booked through HeyVacay, an OpenTable Premier Booking Partner. Please ensure to take good care of our customer.`;
    return note.length > OT_NOTE_MAX ? note.slice(0, OT_NOTE_MAX - 1).trimEnd() + '…' : note;
  }

  const prefix = `${header}\nThis reservation was booked through HeyVacay, an OpenTable Premier Booking Partner.\n\nGuest special request: `;
  const suffix = `\n\nWe kindly ask that your team make every effort to accommodate this request. Thank you for taking excellent care of our guest.`;
  // Fit the guest request into whatever room is left under the cap, keeping the
  // framing intact.
  const budget = OT_NOTE_MAX - prefix.length - suffix.length;
  let reqText = req;
  if (budget > 0 && reqText.length > budget) {
    reqText = reqText.slice(0, Math.max(0, budget - 1)).trimEnd() + '…';
  }
  let note = `${prefix}${reqText}${suffix}`;
  // Last-resort guard if even the framing alone exceeds the cap.
  if (note.length > OT_NOTE_MAX) note = note.slice(0, OT_NOTE_MAX - 1).trimEnd() + '…';
  return note;
}

/**
 * Two-step booking: acquire a slot lock (reservation_token), then commit the
 * reservation with the guest's details. Returns null on any failure so the
 * route can fall back to a local confirmation.
 */
export async function bookReservation(args: {
  restaurantId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  partySize: number;
  name: string;
  email?: string;
  phone?: string;
  specialRequest?: string;
}): Promise<OtReservation | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  const dateTime = `${args.date}T${args.time}`;
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  try {
    // Step 1 — lock a slot.
    const lockRes = await fetch(
      `${OPENTABLE.base}/v2/booking/${encodeURIComponent(args.restaurantId)}/slot_locks`,
      {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          party_size: args.partySize,
          date_time: dateTime,
          reservation_attribute: 'default',
        }),
        cache: 'no-store',
      }
    );
    if (!lockRes.ok) return null;
    const lock = (await lockRes.json().catch(() => null)) as
      | { reservation_token?: string }
      | null;
    if (!lock?.reservation_token) return null;

    // Step 2 — commit the reservation.
    const { first, last } = splitName(args.name);
    const body: Record<string, unknown> = {
      reservation_token: lock.reservation_token,
      first_name: first,
      last_name: last,
      email_address: args.email || 'reservations@heyvacay.co',
      reservation_attribute: 'default',
    };
    if (args.phone) {
      body.phone = {
        number: args.phone.replace(/[^\d]/g, ''),
        country_code: 'US',
        phone_type: 'mobile',
      };
    }
    // Always send the HeyVacay Enterprise note (frames the guest request, or a
    // take-good-care note when there isn't one).
    body.special_request = formatReservationNote(args.specialRequest);

    const resvRes = await fetch(
      `${OPENTABLE.base}/v2/booking/${encodeURIComponent(args.restaurantId)}/reservations`,
      { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body), cache: 'no-store' }
    );
    if (!resvRes.ok) return null;
    const resv = (await resvRes.json().catch(() => null)) as
      | { confirmation_number?: string | number; manage_reservation_url?: string }
      | null;
    if (!resv?.confirmation_number) return null;

    return {
      confirmation: String(resv.confirmation_number),
      manageUrl: resv.manage_reservation_url,
      status: 'confirmed',
    };
  } catch {
    return null;
  }
}
