import 'server-only';

/**
 * Stateless signed sessions for enterprise accounts, plus the one-time
 * verify/reset token helpers.
 *
 * A session is a compact HMAC-signed token (`<payloadB64url>.<sigHex>`) stored
 * in an httpOnly, Secure, SameSite=Lax cookie — so it never reaches client JS
 * and can't be read or forged in the browser. We sign with AUTH_SESSION_SECRET
 * (Node core `crypto`, no JWT dependency). Verification is constant-time and
 * checks the expiry, so a tampered or stale cookie simply reads as "no session".
 *
 * Verify/reset tokens are random, emailed to the user in the clear, and stored
 * on the identity ONLY as an HMAC hash — the raw token never touches the DB.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { AUTH_SESSION_SECRET } from '@/lib/config.server';

export const SESSION_COOKIE = 'hv_ent_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionPayload {
  /** Workspace user id. */
  sub: string;
  email: string;
  companyId: string;
  accountKey?: string;
  role: string;
  name?: string;
  /** Issued-at / expiry (epoch ms). */
  iat: number;
  exp: number;
}

/* ----------------------------- signing ----------------------------- */

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payloadB64: string): string {
  return createHmac('sha256', AUTH_SESSION_SECRET).update(payloadB64).digest('hex');
}

/** Build a signed session token for a payload (iat/exp filled in here). */
export function createSessionToken(
  data: Omit<SessionPayload, 'iat' | 'exp'>,
  ttlMs = SESSION_TTL_MS,
): string {
  const now = Date.now();
  const payload: SessionPayload = { ...data, iat: now, exp: now + ttlMs };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Verify + decode a session token. Returns null on any tamper/expiry/parse error. */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const expected = sign(payloadB64);
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(fromB64url(payloadB64).toString('utf8')) as SessionPayload;
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ----------------------------- cookie ------------------------------ */

/** Issue the session cookie (call from a route handler / server action). */
export async function setSessionCookie(
  data: Omit<SessionPayload, 'iat' | 'exp'>,
): Promise<void> {
  const token = createSessionToken(data);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Read + verify the current request's session, or null. */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Clear the session cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/* ------------------- one-time verify / reset tokens ---------------- */

/** A fresh high-entropy token for an email link (returned in the clear once). */
export function newToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

/** A short numeric code for in-app email verification (6 digits). */
export function newCode(): string {
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

/** HMAC hash a token/code for at-rest storage on the identity. */
export function hashToken(token: string): string {
  return createHmac('sha256', AUTH_SESSION_SECRET).update(token).digest('hex');
}

/** Constant-time check of a presented token/code against a stored hash + expiry. */
export function tokenMatches(
  presented: string | undefined | null,
  storedHash: string | undefined | null,
  expiresAt: number | undefined | null,
): boolean {
  if (!presented || !storedHash) return false;
  if (!expiresAt || Date.now() > expiresAt) return false;
  try {
    const a = Buffer.from(hashToken(presented), 'hex');
    const b = Buffer.from(storedHash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
