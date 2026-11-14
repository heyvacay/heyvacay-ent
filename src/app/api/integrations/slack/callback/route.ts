import { NextResponse } from 'next/server';
import { connectViaOAuth } from '@/lib/integrations/slack.server';
import { SLACK } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function appOrigin(req: Request): string {
  const first = (n: string) => (req.headers.get(n) || '').split(',')[0].trim();
  const host = first('x-forwarded-host') || first('host');
  const proto = first('x-forwarded-proto') || 'https';
  if (host && !/^(0\.0\.0\.0|127\.0\.0\.1|localhost)(:|$)/.test(host)) return `${proto}://${host}`;
  try {
    return new URL(req.url).origin;
  } catch {
    return '';
  }
}

/** OAuth callback for the "Add to Slack" flow — exchange code → store webhook. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const base = appOrigin(req);
  const dest = (status: string, extra?: Record<string, string>) => {
    const to = new URL('/app/integrations/slack', base || req.url);
    to.searchParams.set('conn', status);
    for (const [k, v] of Object.entries(extra || {})) to.searchParams.set(k, v);
    return NextResponse.redirect(to);
  };

  if (params.get('error')) return dest('error', { reason: params.get('error') || 'declined' });
  const code = params.get('code') || '';
  const state = params.get('state') || '';
  if (!code) return dest('error', { reason: 'missing_code' });

  // The redirect_uri in the token exchange must match the one used to authorize.
  const redirectUri = SLACK.redirectUri || `${base}/api/integrations/slack/callback`;
  const r = await connectViaOAuth(code, state, redirectUri);
  if (!r.ok) return dest('error', { reason: (r.error || 'failed').slice(0, 160) });
  return dest('connected', r.label ? { team: r.label } : undefined);
}
