import { NextResponse } from 'next/server';
import { getIdentity, patchIdentity, emailKey } from '@/lib/auth/identityStore.server';
import { newCode, hashToken } from '@/lib/auth/session.server';
import { sendTemplateEmail } from '@/lib/email.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VERIFY_TTL_MS = 10 * 60 * 1000;

/**
 * Re-send the email-verification code. Always responds ok (no enumeration); only
 * actually emails a new code when there's an unverified identity. Body: { email }.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const email = emailKey(String(body.email ?? ''));
  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

  const identity = await getIdentity(email);
  if (identity && !identity.emailVerified) {
    const code = newCode();
    await patchIdentity(email, {
      verifyTokenHash: hashToken(code),
      verifyExpiresAt: Date.now() + VERIFY_TTL_MS,
    });
    await sendTemplateEmail('verifyCode', email, { code });
  }
  return NextResponse.json({ ok: true });
}
