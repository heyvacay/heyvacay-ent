import { NextResponse } from 'next/server';
import { policies } from '@/lib/integrations/expensify.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  try {
    const list = await policies(companyId);
    return NextResponse.json({ count: list.length, policies: list });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
