import { NextResponse } from 'next/server';
import { QUICKBOOKS } from '@/lib/config.server';
import { getConnection } from '@/lib/integrations/tokenStore.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Connection status for a company's QuickBooks (no tokens leak to the client). */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }
  const conn = await getConnection(companyId, 'quickbooks');
  return NextResponse.json({
    serverConfigured: QUICKBOOKS.configured,
    env: QUICKBOOKS.env,
    connected: conn?.status === 'connected',
    status: conn?.status || 'disconnected',
    companyName: conn?.companyName || null,
    realmId: conn?.realmId || null,
    connectedAt: conn?.connectedAt || null,
    accountMap: conn?.accountMap || {},
    paymentAccountId: conn?.paymentAccountId || null,
    mappedCount: conn?.accountMap ? Object.keys(conn.accountMap).length : 0,
  });
}
