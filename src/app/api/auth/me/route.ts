import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session.server';
import { getIdentity } from '@/lib/auth/identityStore.server';
import { accountOf } from '@/lib/auth/account.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Who am I? Reads the signed session cookie and returns the account, or
 * { authenticated: false }. Re-checks the identity so a deactivated account
 * (or one whose role changed) is reflected immediately rather than trusting the
 * cookie's snapshot.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false });

  const identity = await getIdentity(session.email);
  if (!identity || identity.status === 'disabled' || !identity.emailVerified) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true, account: accountOf(identity) });
}
