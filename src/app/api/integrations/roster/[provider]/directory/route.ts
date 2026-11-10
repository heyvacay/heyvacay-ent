import { NextResponse } from 'next/server';
import { rosterDirectory } from '@/lib/integrations/roster.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live, normalized directory for a connected roster provider. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  try {
    const people = await rosterDirectory(provider, companyId);
    return NextResponse.json({ count: people.length, people });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
