import { NextResponse } from 'next/server';
import { connect } from '@/lib/integrations/expensify.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  const creds: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) if (k !== 'companyId' && typeof v === 'string') creds[k] = v;
  const r = await connect(companyId, creds);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, count: r.count });
}
