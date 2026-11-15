import { NextResponse } from 'next/server';
import { getIdentity, patchIdentity, emailKey } from '@/lib/auth/identityStore.server';
import { newToken, hashToken } from '@/lib/auth/session.server';
import { sendTemplateEmail } from '@/lib/email.server';
import { APP_BASE_URL } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESET_TTL_MS = 60 * 60 * 1000; // 60 min

/**
 * Start a password reset. ALWAYS responds ok — it never reveals whether an
 * account exists (anti-enumeration). When there is a real account, it stores a
 * single-use reset token (hashed) and emails a link to /reset. Body: { email }.
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
  if (identity && identity.passwordHash && identity.status !== 'disabled') {
    const token = newToken();
    await patchIdentity(email, {
      resetTokenHash: hashToken(token),
      resetExpiresAt: Date.now() + RESET_TTL_MS,
    });
    const resetUrl = `${APP_BASE_URL}/reset?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    await sendTemplateEmail('passwordReset', email, {
      name: identity.firstName,
      resetUrl,
    });
  }

  return NextResponse.json({ ok: true });
}
