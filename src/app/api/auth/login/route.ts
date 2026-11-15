import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password.server';
import { getIdentity, patchIdentity, emailKey } from '@/lib/auth/identityStore.server';
import { accountOf, issueSession } from '@/lib/auth/account.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 min lock after MAX_FAILS

/**
 * Email + password login. Verifies the scrypt hash, enforces email verification,
 * applies a simple lockout after repeated failures, and issues the session
 * cookie on success. Body: { email, password }.
 *
 * Responses are deliberately generic ("Invalid email or password") so the
 * endpoint can't be used to enumerate which emails have accounts.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const email = emailKey(String(body.email ?? ''));
  const password = String(body.password ?? '');
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const identity = await getIdentity(email);
  const GENERIC = { error: 'Invalid email or password.' };

  if (!identity || !identity.passwordHash || identity.status === 'invited') {
    // Equalize timing a little against the hash path, then fail generically.
    await verifyPassword(password, 'scrypt$16384$8$1$AAAA$AAAA');
    return NextResponse.json(GENERIC, { status: 401 });
  }

  if (identity.status === 'disabled') {
    return NextResponse.json(
      { error: 'This account has been deactivated. Contact your administrator.' },
      { status: 403 },
    );
  }

  if (identity.lockedUntil && Date.now() < identity.lockedUntil) {
    const mins = Math.ceil((identity.lockedUntil - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429 },
    );
  }

  const ok = await verifyPassword(password, identity.passwordHash);
  if (!ok) {
    const fails = (identity.failedLogins ?? 0) + 1;
    await patchIdentity(email, {
      failedLogins: fails,
      lockedUntil: fails >= MAX_FAILS ? Date.now() + LOCK_MS : undefined,
    });
    return NextResponse.json(GENERIC, { status: 401 });
  }

  if (!identity.emailVerified) {
    // Correct password, but email not confirmed yet — steer to verification.
    return NextResponse.json(
      { error: 'Please verify your email to continue.', needsVerify: true, email },
      { status: 403 },
    );
  }

  // Success — clear counters and issue the session.
  const fresh = await patchIdentity(email, { failedLogins: 0, lockedUntil: undefined });
  await issueSession(fresh ?? identity);
  return NextResponse.json({ ok: true, account: accountOf(fresh ?? identity) });
}
