import { NextResponse } from 'next/server';
import { getIdentity, patchIdentity, emailKey } from '@/lib/auth/identityStore.server';
import { tokenMatches } from '@/lib/auth/session.server';
import { accountOf, issueSession } from '@/lib/auth/account.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Confirm the email-verification code from /api/auth/register (or /resend),
 * mark the identity verified, and issue the session cookie. Body: { email, code }.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const email = emailKey(String(body.email ?? ''));
  const code = String(body.code ?? '').trim();
  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code are required.' }, { status: 400 });
  }

  const identity = await getIdentity(email);
  if (!identity) {
    return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 400 });
  }
  if (identity.emailVerified && !identity.verifyTokenHash) {
    // Already verified — just (re)issue a session so the flow continues.
    await issueSession(identity);
    return NextResponse.json({ ok: true, account: accountOf(identity) });
  }
  if (!tokenMatches(code, identity.verifyTokenHash, identity.verifyExpiresAt)) {
    return NextResponse.json({ error: 'That code is invalid or has expired.' }, { status: 400 });
  }

  const updated = await patchIdentity(email, {
    emailVerified: true,
    verifyTokenHash: undefined,
    verifyExpiresAt: undefined,
    failedLogins: 0,
    lockedUntil: undefined,
  });
  if (!updated) {
    return NextResponse.json({ error: 'Could not verify. Try again.' }, { status: 500 });
  }

  await issueSession(updated);
  return NextResponse.json({ ok: true, account: accountOf(updated) });
}
