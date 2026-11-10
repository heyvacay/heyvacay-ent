import { NextResponse } from 'next/server';
import { patchConnection } from '@/lib/integrations/tokenStore.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Save the category → QuickBooks expense-account map and the payment account
 * purchases post against. Stored on the connection so the sync can run later
 * without re-asking.
 */
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
  const accountMap =
    body.accountMap && typeof body.accountMap === 'object'
      ? (body.accountMap as Record<string, string>)
      : undefined;
  const paymentAccountId =
    typeof body.paymentAccountId === 'string' ? body.paymentAccountId : undefined;
  const defaultVendorId =
    typeof body.defaultVendorId === 'string' ? body.defaultVendorId : undefined;

  const updated = await patchConnection(companyId, 'quickbooks', {
    ...(accountMap ? { accountMap } : {}),
    ...(paymentAccountId !== undefined ? { paymentAccountId } : {}),
    ...(defaultVendorId !== undefined ? { defaultVendorId } : {}),
  });
  if (!updated) {
    return NextResponse.json(
      { error: 'QuickBooks is not connected for this company.' },
      { status: 409 }
    );
  }
  return NextResponse.json({
    ok: true,
    accountMap: updated.accountMap || {},
    paymentAccountId: updated.paymentAccountId || null,
  });
}
