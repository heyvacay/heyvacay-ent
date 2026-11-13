import { API_BASE_URL, BACKEND_SERVICE_TOKEN, isLiveBooking } from './config.server';

/**
 * Server-only auth for the Enterprise service account.
 *
 * The shared HeyVacay backend is email-OTP only — there is no password login a
 * server could perform. Instead the backend accepts a dedicated enterprise
 * service token (ENTERPRISE_SERVICE_TOKEN there = ENT_BACKEND_SERVICE_TOKEN
 * here): presented as the bearer, it authenticates as the corporate service
 * account and marks the request as the 'enterprise' channel (net pricing). The
 * token lives only on the server (ECS secret); it never reaches the client.
 */

/**
 * Auth headers for the Enterprise service account, for use on plain proxy
 * fetches (search / suggest / hotel details). The shared backend guards these
 * browse endpoints with @PublicWhenGuestBrowse — i.e. they 401 for an
 * unauthenticated caller unless GUEST_BROWSE_ENABLED is on. The enterprise app
 * is a logged-in service, so it must present the service token: the backend
 * then authenticates it as the enterprise account AND returns NET pricing,
 * keeping search prices consistent with what booking charges.
 *
 * Degrades gracefully: when no service token is configured (local/demo), it
 * returns no headers, so the call stays exactly as before (unauthenticated).
 */
export function serviceAuthHeaders(): Record<string, string> {
  if (!BACKEND_SERVICE_TOKEN) return {};
  return {
    Authorization: `Bearer ${BACKEND_SERVICE_TOKEN}`,
    'X-HeyVacay-Channel': 'enterprise',
  };
}

/** fetch() with an AbortController timeout (ms). */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Resilient JSON fetch for *browse* endpoints that carry NO pricing — the
 * city/airport typeahead (suggest/places). These are the surfaces that "break
 * everywhere at once": the shared backend 401s browse calls unless the caller is
 * authenticated, so a drifted/expired enterprise service token makes every
 * suggest return empty and the pickers go dead.
 *
 * To keep them always-on, this tries the call authenticated as the enterprise
 * service account first (unchanged behavior when the token is healthy), and if
 * that attempt fails — network error, timeout, non-2xx (e.g. 401 from a bad
 * token), or a 200 with an empty result set — it retries the SAME call
 * UNAUTHENTICATED (guest browse), which the consumer site uses and which returns
 * the same place names + ids. Only suggest/places use this; pricing-sensitive
 * search/booking still always authenticate. Returns parsed JSON, or null if
 * every attempt fails (the caller then yields an empty list as a last resort).
 *
 * NB: the unauth fallback recovers data only when guest browse is enabled on the
 * backend; the permanent belt-and-suspenders is keeping ENT_BACKEND_SERVICE_TOKEN
 * in sync with the backend's ENTERPRISE_SERVICE_TOKEN. Every failed attempt is
 * logged so a recurrence shows up in the ENT logs instead of a silent empty list.
 */
export async function browseFetchJson(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {}
): Promise<unknown | null> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const method = init.method ?? 'GET';
  const timeoutMs = init.timeoutMs ?? 6000;
  const commonHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
  };
  const body = init.body != null ? JSON.stringify(init.body) : undefined;

  // Attempt order: authenticated (if a token is configured), then unauthenticated.
  const attempts: Array<Record<string, string>> = [];
  const authed = serviceAuthHeaders();
  if (Object.keys(authed).length > 0) attempts.push(authed);
  attempts.push({}); // guest-browse fallback

  for (let i = 0; i < attempts.length; i++) {
    const isLast = i === attempts.length - 1;
    try {
      const res = await fetchWithTimeout(
        url,
        { method, headers: { ...commonHeaders, ...attempts[i] }, body, cache: 'no-store' },
        timeoutMs
      );
      if (!res.ok) {
        console.error(`[browseFetch] ${method} ${path} -> ${res.status}${isLast ? '' : ' (retrying unauthenticated)'}`);
        continue;
      }
      const data = await res.json().catch(() => null);
      // A 200 with an empty results array can itself be an auth/channel symptom,
      // so treat it as a soft failure and let the unauth attempt run — unless this
      // was already the last attempt.
      const looksEmpty =
        data == null ||
        (!!data && typeof data === 'object' && 'results' in data &&
          Array.isArray((data as { results: unknown[] }).results) &&
          (data as { results: unknown[] }).results.length === 0);
      if (looksEmpty && !isLast) continue;
      return data;
    } catch (e) {
      console.error(`[browseFetch] ${method} ${path} attempt ${i + 1} failed: ${(e as Error)?.message || e}`);
      continue;
    }
  }
  return null;
}

/**
 * Authenticated POST/GET against the backend as the Enterprise service account.
 * Attaches the service token + enterprise channel header. Returns the raw
 * Response so callers can read status + body (the booking flow branches on
 * supplier status codes).
 */
export async function backendFetch(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<Response> {
  if (!isLiveBooking()) {
    throw new Error('Live booking is not configured (no enterprise service token).');
  }
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  return fetch(url, {
    method: init.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${BACKEND_SERVICE_TOKEN}`,
      'X-HeyVacay-Channel': 'enterprise',
      ...(init.headers ?? {}),
    },
    body: init.body != null ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
}
