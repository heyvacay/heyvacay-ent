import { API_BASE_URL, BACKEND_AUTH, isLiveBooking } from './config.server';

/**
 * Server-only auth for the Enterprise service account.
 *
 * Enterprise books through the shared HeyVacay backend under one corporate
 * service account. We log in once (server-side), cache the access token in
 * memory, and attach it as a bearer on every booking call. On a 401 we
 * re-login once and retry — the backend rotates tokens, so a cached token can
 * go stale. Credentials never leave the server.
 */

let cachedToken: string | null = null;
let tokenFetchedAt = 0;
// Re-login well before the backend's access-token lifetime; a 401 also forces it.
const TOKEN_TTL_MS = 30 * 60 * 1000;
let loginInFlight: Promise<string> | null = null;

async function login(): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: BACKEND_AUTH.email, password: BACKEND_AUTH.password }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  const token = data?.accessToken || data?.access_token || data?.data?.accessToken;
  if (!res.ok || !token) {
    throw new Error(`Backend service-account login failed (${res.status}).`);
  }
  cachedToken = token;
  tokenFetchedAt = Date.now();
  return token;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!isLiveBooking()) {
    throw new Error('Live booking is not configured (no service account).');
  }
  if (!forceRefresh && cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }
  // Collapse concurrent logins into one.
  if (!loginInFlight) {
    loginInFlight = login().finally(() => {
      loginInFlight = null;
    });
  }
  return loginInFlight;
}

/**
 * Authenticated POST/GET against the backend as the service account. Retries
 * once with a fresh token on 401. Returns the raw Response so callers can read
 * status + body (the booking flow branches on supplier status codes).
 */
export async function backendFetch(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const run = async (token: string) =>
    fetch(url, {
      method: init.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
      body: init.body != null ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });

  let token = await getToken();
  let res = await run(token);
  if (res.status === 401) {
    token = await getToken(true);
    res = await run(token);
  }
  return res;
}
