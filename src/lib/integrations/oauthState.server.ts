import 'server-only';

/**
 * HMAC-signed OAuth `state` shared by the OAuth integrations (QuickBooks, Xero,
 * …) so a callback can trust the company id it carries without a server-side
 * session. Signed with OAUTH_STATE_SECRET; 1-hour TTL.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { OAUTH_STATE_SECRET } from '@/lib/config.server';

export function signState(companyId: string, provider: string): string {
  const payload = Buffer.from(
    JSON.stringify({ c: companyId, p: provider, t: Date.now(), n: Math.random().toString(36).slice(2) })
  ).toString('base64url');
  const sig = createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Returns the companyId if the state is valid, matches the provider, and is < 1h old. */
export function verifyState(state: string, provider: string): string | null {
  try {
    const [payload, sig] = String(state).split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.c || typeof data.t !== 'number') return null;
    if (data.p && data.p !== provider) return null;
    if (Date.now() - data.t > 60 * 60 * 1000) return null;
    return String(data.c);
  } catch {
    return null;
  }
}
