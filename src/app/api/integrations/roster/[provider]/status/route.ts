import { NextResponse } from 'next/server';
import { rosterStatus } from '@/lib/integrations/roster.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  const status = await rosterStatus(provider, companyId);
  if ('error' in status) return NextResponse.json(status, { status: 404 });
  return NextResponse.json(status);
}
