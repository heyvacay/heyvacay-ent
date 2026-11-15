import { NextResponse } from 'next/server';
import { hashPassword, passwordProblem } from '@/lib/auth/password.server';
import { getIdentity, patchIdentity, emailKey } from '@/lib/auth/identityStore.server';
import { tokenMatches } from '@/lib/auth/session.server';
import { accountOf, issueSession } from '@/lib/auth/account.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Complete a password reset from the emailed link. Verifies the single-use
 * token, sets the new password, clears any lockout, and — since clicking an
 * emailed link proves control of the inbox — marks the email verified and signs
 * the user in. Body: { email, token, password }.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const email = emailKey(String(body.email ?? ''));
  const token = String(body.token ?? '');
  const password = String(body.password ?? '');

  if (!email || !token) {
    return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 });
  }
  const pwErr = passwordProblem(password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  const identity = await getIdentity(email);
  if (!identity || !tokenMatches(token, identity.resetTokenHash, identity.resetExpiresAt)) {
    return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 });
  }

  const updated = await patchIdentity(email, {
    passwordHash: await hashPassword(password),
    emailVerified: true,
    resetTokenHash: undefined,
    resetExpiresAt: undefined,
    verifyTokenHash: undefined,
    verifyExpiresAt: undefined,
    failedLogins: 0,
    lockedUntil: undefined,
    status: identity.status === 'invited' ? 'active' : identity.status,
  });
  if (!updated) {
    return NextResponse.json({ error: 'Could not reset your password. Try again.' }, { status: 500 });
  }

  await issueSession(updated);
  return NextResponse.json({ ok: true, account: accountOf(updated) });
}
