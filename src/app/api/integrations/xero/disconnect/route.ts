import { NextResponse } from 'next/server';
import { XERO } from '@/lib/config.server';
import { getConnection, deleteConnection } from '@/lib/integrations/tokenStore.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVOKE_URL = 'https://identity.xero.com/connect/revocation';

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });

  const conn = await getConnection(companyId, 'xero');
  if (conn?.refreshToken && XERO.configured) {
    try {
      const basic = Buffer.from(`${XERO.clientId}:${XERO.clientSecret}`).toString('base64');
      await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: conn.refreshToken }).toString(),
      });
    } catch {
      /* best-effort */
    }
  }
  await deleteConnection(companyId, 'xero');
  return NextResponse.json({ ok: true });
}
