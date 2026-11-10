import { NextResponse } from 'next/server';
import { listAccounts } from '@/lib/integrations/netsuite.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  try {
    const { expense, payment } = await listAccounts(companyId);
    return NextResponse.json({ expense, payment });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
