import { NextResponse } from 'next/server';
import { XERO } from '@/lib/config.server';
import { buildAuthorizeUrl } from '@/lib/integrations/xero.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Start the Xero OAuth flow (302 to Xero's consent screen with a signed state). */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  if (!XERO.configured) {
    return NextResponse.json(
      { error: 'Xero is not configured on the server yet (app client id/secret missing).' },
      { status: 503 }
    );
  }
  return NextResponse.redirect(buildAuthorizeUrl(companyId));
}
