import { NextResponse } from 'next/server';
import { connect } from '@/lib/integrations/slack.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Validate + store a company's Slack incoming webhook (sends a hello message). */
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
