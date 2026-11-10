import { NextResponse } from 'next/server';
import { QUICKBOOKS } from '@/lib/config.server';
import { verifyState, exchangeCode } from '@/lib/integrations/quickbooks.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The public origin to send the browser back to. Behind the ALB, req.url carries
 * the container's internal address (0.0.0.0:3000), so we must use the forwarded
 * host header — and fall back to the configured public callback origin — rather
 * than req.url, or the post-OAuth redirect lands on an unreachable host.
 */
function appOrigin(req: Request): string {
  const first = (name: string) => (req.headers.get(name) || '').split(',')[0].trim();
  const host = first('x-forwarded-host') || first('host');
  const proto = first('x-forwarded-proto') || 'https';
  const isInternal = /^(0\.0\.0\.0|127\.0\.0\.1|localhost)(:|$)/.test(host);
  if (host && !isInternal) return `${proto}://${host}`;
  // Fall back to the public origin we registered as the OAuth redirect URI.
  try {
    return new URL(QUICKBOOKS.redirectUri).origin;
  } catch {
    try {
      return new URL(req.url).origin;
    } catch {
      return '';
    }
  }
}

/**
 * Intuit redirects the user's browser here after consent with ?code, ?realmId,
 * ?state. We verify the signed state (→ companyId), exchange the code for
 * tokens, persist the connection, and send the user back to the QuickBooks
 * integration page with a success/error flag.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const base = appOrigin(req);
  const dest = (status: string, extra?: Record<string, string>) => {
    const to = new URL('/app/integrations/quickbooks', base || req.url);
    to.searchParams.set('conn', status);
    for (const [k, v] of Object.entries(extra || {})) to.searchParams.set(k, v);
    return NextResponse.redirect(to);
  };

  // User declined or Intuit returned an error.
  if (params.get('error')) {
    return dest('error', { reason: params.get('error_description') || params.get('error') || 'declined' });
  }

  const code = params.get('code') || '';
  const realmId = params.get('realmId') || '';
  const state = params.get('state') || '';
  const companyId = verifyState(state);

  if (!companyId) return dest('error', { reason: 'invalid_state' });
  if (!code || !realmId) return dest('error', { reason: 'missing_code' });

  try {
    const conn = await exchangeCode(companyId, code, realmId);
    return dest('connected', conn.companyName ? { company: conn.companyName } : undefined);
  } catch (err) {
    return dest('error', { reason: (err as Error).message.slice(0, 160) });
  }
}
