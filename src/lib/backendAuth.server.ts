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
