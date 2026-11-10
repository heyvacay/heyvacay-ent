import { NextResponse } from 'next/server';
import { notify } from '@/lib/integrations/slack.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Send a test message to the company's connected Slack. */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  const r = await notify(companyId, ':white_check_mark: Test from HeyVacay — your Slack notifications are working.');
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
