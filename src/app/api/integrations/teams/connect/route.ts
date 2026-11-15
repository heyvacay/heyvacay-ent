import { NextResponse } from 'next/server';
import { connect } from '@/lib/integrations/teams.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { companyId?: string; webhookUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const companyId = (body.companyId || '').trim();
  const webhookUrl = (body.webhookUrl || '').trim();
  if (!companyId || !webhookUrl) {
    return NextResponse.json({ error: 'companyId and webhookUrl are required.' }, { status: 400 });
  }
  const r = await connect(companyId, webhookUrl);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
