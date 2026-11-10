import { NextResponse } from 'next/server';
import { QUICKBOOKS } from '@/lib/config.server';
import { getConnection, deleteConnection } from '@/lib/integrations/tokenStore.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

/** Disconnect a company's QuickBooks: best-effort token revoke at Intuit, then drop the stored connection. */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }

  const conn = await getConnection(companyId, 'quickbooks');
  if (conn?.refreshToken && QUICKBOOKS.configured) {
    try {
      const basic = Buffer.from(`${QUICKBOOKS.clientId}:${QUICKBOOKS.clientSecret}`).toString('base64');
      await fetch(REVOKE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ token: conn.refreshToken }),
      });
    } catch {
      /* best-effort; proceed to delete locally regardless */
    }
  }
  await deleteConnection(companyId, 'quickbooks');
  return NextResponse.json({ ok: true });
}
