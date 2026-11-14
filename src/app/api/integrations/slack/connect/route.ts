import { NextResponse } from 'next/server';
import { connect, slackOAuthConfigured, slackAuthorizeUrl } from '@/lib/integrations/slack.server';
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

/**
 * One-click "Add to Slack": redirect the admin to Slack's consent screen. Slack
 * sends them back to /callback with a code we exchange for the channel webhook —
 * no app-building, no copy/paste. Only when the platform app is configured.
 */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  if (!slackOAuthConfigured())
    return NextResponse.json({ error: 'The HeyVacay Slack app is not configured on the server.' }, { status: 503 });
  // Slack requires redirect_uri to exactly match a Redirect URL in the app, so
  // prefer the configured one; fall back to this origin for local dev.
  const redirectUri = SLACK.redirectUri || `${appOrigin(req)}/api/integrations/slack/callback`;
  const url = slackAuthorizeUrl(companyId, redirectUri);
  if (!url) return NextResponse.json({ error: 'Could not build the Slack authorize URL.' }, { status: 500 });
  return NextResponse.redirect(url);
}

/** Manual fallback: validate + store a company's Slack incoming webhook (sends a hello message). */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const webhookUrl = String(body.webhookUrl || '').trim();
  if (!companyId || !webhookUrl) {
    return NextResponse.json({ error: 'companyId and webhookUrl are required.' }, { status: 400 });
  }
  const r = await connect(companyId, webhookUrl);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
