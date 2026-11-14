import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/integrations/tokenStore.server';
import { slackOAuthConfigured } from '@/lib/integrations/slack.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  const conn = await getConnection(companyId, 'slack');
  const url = conn?.config?.webhookUrl || '';
  // Never return the full webhook (it's a secret); just a masked tail.
  const masked = url ? `…/${url.split('/').slice(-1)[0].slice(-6)}` : null;
  return NextResponse.json({
    connected: conn?.status === 'connected',
    webhookHint: masked,
    connectedAt: conn?.connectedAt || null,
    team: conn?.companyName || conn?.config?.team || null,
    // When true, the panel offers one-click "Add to Slack" (OAuth); otherwise it
    // falls back to the manual webhook-paste form.
    oauthConfigured: slackOAuthConfigured(),
  });
}
