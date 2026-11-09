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
