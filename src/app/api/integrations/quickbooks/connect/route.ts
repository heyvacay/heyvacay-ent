import { NextResponse } from 'next/server';
import { QUICKBOOKS } from '@/lib/config.server';
import { buildAuthorizeUrl } from '@/lib/integrations/quickbooks.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Start the QuickBooks OAuth flow. The client sends the company (workspace) id;
 * we 302 to Intuit's consent screen with a signed `state` carrying that id, so
 * the callback can trust which company just connected.
 */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }
  if (!QUICKBOOKS.configured) {
    return NextResponse.json(
      {
        error:
          'QuickBooks is not configured on the server yet (Intuit app client id/secret missing).',
      },
      { status: 503 }
    );
  }
  return NextResponse.redirect(buildAuthorizeUrl(companyId));
}
