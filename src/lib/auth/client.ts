'use client';

/**
 * Client calls to the enterprise auth API (/api/auth/*). The session itself is
 * an httpOnly cookie the browser can't read — these just drive the flows and
 * return the small JSON each route sends back.
 */

export interface AuthAccount {
  userId: string;
  email: string;
  companyId: string;
  accountKey?: string;
  role: string;
  firstName: string;
  lastName: string;
}

interface AuthResult {
  ok?: boolean;
  error?: string;
  needsVerify?: boolean;
  exists?: boolean;
  email?: string;
  account?: AuthAccount;
  authenticated?: boolean;
}

async function post(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as AuthResult;
    if (!res.ok) return { error: data.error || 'Something went wrong. Try again.', ...data };
    return data;
  } catch {
    return { error: 'Network error. Check your connection and try again.' };
  }
}

export const authRegister = (b: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyId: string;
  accountKey?: string;
  userId?: string;
  role?: string;
}) => post('/api/auth/register', b);

export const authVerify = (email: string, code: string) =>
  post('/api/auth/verify', { email, code });

export const authResend = (email: string) => post('/api/auth/resend', { email });

export const authLogin = (email: string, password: string) =>
  post('/api/auth/login', { email, password });

export const authForgot = (email: string) => post('/api/auth/forgot', { email });

export const authReset = (email: string, token: string, password: string) =>
  post('/api/auth/reset', { email, token, password });

export const authChangePassword = (currentPassword: string, newPassword: string) =>
  post('/api/auth/change-password', { currentPassword, newPassword });

export async function authLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
}

export async function authMe(): Promise<{ authenticated: boolean; account?: AuthAccount }> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as AuthResult;
    return { authenticated: Boolean(data.authenticated), account: data.account };
  } catch {
    return { authenticated: false };
  }
}

/**
 * After a successful real login / verify / reset, point the local workspace at
 * the authenticated account and hard-navigate into the app. The httpOnly session
 * cookie is already set server-side; here we just set the active-account pointer
 * (which makes the store fetch that company's shared workspace from the server,
 * so this works on a device that's never seen the account) and the active user.
 */
export function commitRealLogin(account: AuthAccount, companyName?: string): void {
  const id = account.companyId;
  const key = id ? `hv_ent_acct_${id}` : 'hv_ent_demo_v2';
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as { state?: Record<string, unknown> }) : null;
    const baseState = parsed?.state ?? {};
    localStorage.setItem(
      key,
      JSON.stringify({ state: { ...baseState, activeUserId: account.userId }, role: account.role }),
    );
    if (id) {
      const domain = account.email.includes('@') ? account.email.split('@')[1] : '';
      localStorage.setItem(
        'hv_ent_active_account',
        JSON.stringify({ id, name: companyName || 'Your company', domain }),
      );
    } else {
      localStorage.removeItem('hv_ent_active_account');
    }
    sessionStorage.removeItem('hv_view_as');
    sessionStorage.removeItem('hv_view_as_ctx');
    localStorage.setItem('hv_ent_signed_in', '1');
    localStorage.setItem('hv_ent_experience', 'demo');
  } catch {
    /* ignore storage errors — /app still loads a usable workspace */
  }
  window.location.href = '/app';
}
