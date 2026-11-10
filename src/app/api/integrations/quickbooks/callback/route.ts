import { NextResponse } from 'next/server';
import { verifyState, exchangeCode } from '@/lib/integrations/quickbooks.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Intuit redirects the user's browser here after consent with ?code, ?realmId,
 * ?state. We verify the signed state (→ companyId), exchange the code for
 * tokens, persist the connection, and send the user back to the QuickBooks
 * integration page with a success/error flag.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const dest = (status: string, extra?: Record<string, string>) => {
    const to = new URL('/app/integrations/quickbooks', req.url);
    to.searchParams.set('qbo', status);
    for (const [k, v] of Object.entries(extra || {})) to.searchParams.set(k, v);
    return NextResponse.redirect(to);
  };

  // User declined or Intuit returned an error.
  if (params.get('error')) {
    return dest('error', { reason: params.get('error_description') || params.get('error') || 'declined' });
  }

  const code = params.get('code') || '';
  const realmId = params.get('realmId') || '';
  const state = params.get('state') || '';
  const companyId = verifyState(state);

  if (!companyId) return dest('error', { reason: 'invalid_state' });
  if (!code || !realmId) return dest('error', { reason: 'missing_code' });

  try {
    const conn = await exchangeCode(companyId, code, realmId);
    return dest('connected', conn.companyName ? { company: conn.companyName } : undefined);
  } catch (err) {
    return dest('error', { reason: (err as Error).message.slice(0, 160) });
  }
}
