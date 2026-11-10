import { NextResponse } from 'next/server';
import { getRosterProvider, rosterAuthorizeUrl, rosterConnectApiKey } from '@/lib/integrations/roster.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** OAuth providers: GET redirects to the provider's consent screen. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const def = getRosterProvider(provider);
  if (!def) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });
  if (def.kind !== 'oauth') return NextResponse.json({ error: 'This provider connects with an API key.' }, { status: 400 });
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  if (!def.configured()) return NextResponse.json({ error: `${def.authProviderName} app is not configured on the server.` }, { status: 503 });
  const url = rosterAuthorizeUrl(provider, companyId);
  if (!url) return NextResponse.json({ error: 'Could not build authorize URL.' }, { status: 500 });
  return NextResponse.redirect(url);
}

/** API-key providers: POST validates + stores the per-company credentials. */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  const creds: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k !== 'companyId' && typeof v === 'string') creds[k] = v;
  }
  const r = await rosterConnectApiKey(provider, companyId, creds);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, count: r.count, label: r.label });
}
