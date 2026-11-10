import { NextResponse } from 'next/server';
import { XERO } from '@/lib/config.server';
import { verifyState, exchangeCode } from '@/lib/integrations/xero.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public origin (behind the ALB req.url is the internal host — use forwarded host). */
function appOrigin(req: Request): string {
  const first = (n: string) => (req.headers.get(n) || '').split(',')[0].trim();
  const host = first('x-forwarded-host') || first('host');
  const proto = first('x-forwarded-proto') || 'https';
  if (host && !/^(0\.0\.0\.0|127\.0\.0\.1|localhost)(:|$)/.test(host)) return `${proto}://${host}`;
  try {
    return new URL(XERO.redirectUri).origin;
  } catch {
    return new URL(req.url).origin;
  }
}

/** Xero redirects here after consent with ?code & ?state. Exchange + persist, then return to the app. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const base = appOrigin(req);
  const dest = (status: string, extra?: Record<string, string>) => {
    const to = new URL('/app/integrations/xero', base || req.url);
    to.searchParams.set('conn', status);
    for (const [k, v] of Object.entries(extra || {})) to.searchParams.set(k, v);
    return NextResponse.redirect(to);
  };

  if (params.get('error')) {
    return dest('error', { reason: params.get('error_description') || params.get('error') || 'declined' });
  }
  const code = params.get('code') || '';
  const companyId = verifyState(params.get('state') || '', 'xero');
  if (!companyId) return dest('error', { reason: 'invalid_state' });
  if (!code) return dest('error', { reason: 'missing_code' });

  try {
    const conn = await exchangeCode(companyId, code);
    if (!conn.tenantId) return dest('error', { reason: 'no_organisation' });
    return dest('connected', conn.companyName ? { company: conn.companyName } : undefined);
  } catch (err) {
    return dest('error', { reason: (err as Error).message.slice(0, 160) });
  }
}
