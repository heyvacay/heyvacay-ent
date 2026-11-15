import { NextResponse } from 'next/server';
import { disconnect } from '@/lib/integrations/teams.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { companyId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const companyId = (body.companyId || '').trim();
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  await disconnect(companyId);
  return NextResponse.json({ ok: true });
}
