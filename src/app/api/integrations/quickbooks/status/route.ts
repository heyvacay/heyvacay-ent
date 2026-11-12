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
  // A usable connection needs both an active status AND a realm id — without a
  // realm we can't call the Accounting API, so don't claim "connected" (this was
  // the source of "shows connected but mapping says not connected").
  const usable = conn?.status === 'connected' && !!conn?.realmId;
  return NextResponse.json({
    serverConfigured: QUICKBOOKS.configured,
    env: QUICKBOOKS.env,
    connected: usable,
    status:
      conn?.status === 'connected' && !conn?.realmId
        ? 'needs_reconnect'
        : conn?.status || 'disconnected',
    companyName: conn?.companyName || null,
    realmId: conn?.realmId || null,
    orgId: conn?.realmId || null,
    connectedAt: conn?.connectedAt || null,
    accountMap: conn?.accountMap || {},
    paymentAccountId: conn?.paymentAccountId || null,
    mappedCount: conn?.accountMap ? Object.keys(conn.accountMap).length : 0,
  });
}
