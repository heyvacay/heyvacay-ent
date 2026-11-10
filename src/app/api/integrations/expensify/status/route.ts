import { NextResponse } from 'next/server';
import { status } from '@/lib/integrations/expensify.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  return NextResponse.json(await status(companyId));
}
