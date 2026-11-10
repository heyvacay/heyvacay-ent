import { NextResponse } from 'next/server';
import { XERO } from '@/lib/config.server';
import { getConnection } from '@/lib/integrations/tokenStore.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  const conn = await getConnection(companyId, 'xero');
  return NextResponse.json({
    serverConfigured: XERO.configured,
    env: XERO.env,
    connected: conn?.status === 'connected',
    status: conn?.status || 'disconnected',
    companyName: conn?.companyName || null,
    orgId: conn?.tenantId || null,
    connectedAt: conn?.connectedAt || null,
    accountMap: conn?.accountMap || {},
    paymentAccountId: conn?.paymentAccountId || null,
    mappedCount: conn?.accountMap ? Object.keys(conn.accountMap).length : 0,
  });
}
