import { NextResponse } from 'next/server';
import { saveMapping } from '@/lib/integrations/netsuite.server';

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
  const accountMap =
    body.accountMap && typeof body.accountMap === 'object' ? (body.accountMap as Record<string, string>) : undefined;
  const paymentAccountId = typeof body.paymentAccountId === 'string' ? body.paymentAccountId : undefined;
  const updated = await saveMapping(companyId, accountMap, paymentAccountId);
  if (!updated) return NextResponse.json({ error: 'NetSuite is not connected for this company.' }, { status: 409 });
  return NextResponse.json({ ok: true, accountMap: updated.accountMap || {}, paymentAccountId: updated.paymentAccountId || null });
}
