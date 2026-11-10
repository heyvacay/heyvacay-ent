import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/integrations/tokenStore.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  const conn = await getConnection(companyId, 'bamboohr');
  return NextResponse.json({
    connected: conn?.status === 'connected',
    subdomain: conn?.config?.subdomain || null,
    connectedAt: conn?.connectedAt || null,
  });
}
