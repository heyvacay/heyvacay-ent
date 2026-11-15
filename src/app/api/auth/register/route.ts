import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { hashPassword, passwordProblem } from '@/lib/auth/password.server';
import { getIdentity, putIdentity, emailKey, type Identity } from '@/lib/auth/identityStore.server';
import { newCode, hashToken } from '@/lib/auth/session.server';
import { sendTemplateEmail } from '@/lib/email.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFY_TTL_MS = 10 * 60 * 1000;

/**
 * Register a new enterprise account owner (the admin who created a company in
 * the signup flow). Creates the credential record UNVERIFIED and emails a
 * 6-digit code; a session is only issued once /api/auth/verify confirms the
 * code. Joining an existing company happens through an invite, not here.
 *
 * Body: { email, password, firstName, lastName, companyId, accountKey?, userId?, role? }
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
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  const companyId = String(body.companyId ?? '').trim();
  const accountKey = body.accountKey ? String(body.accountKey) : undefined;
  const role = body.role ? String(body.role) : 'admin';

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const pwErr = passwordProblem(password);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });
  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'First and last name are required.' }, { status: 400 });
  }
  if (!companyId) {
    return NextResponse.json({ error: 'Missing company.' }, { status: 400 });
  }

  const existing = await getIdentity(email);
  if (existing && existing.passwordHash && existing.status !== 'invited') {
    // Already a real account — don't let a second signup silently overwrite it.
    return NextResponse.json(
      { error: 'An account with this email already exists. Sign in instead.', exists: true },
      { status: 409 },
    );
  }

  const code = newCode();
  const userId = (body.userId ? String(body.userId) : '') || existing?.userId || `u_${randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();

  const identity: Identity = {
    email,
    userId,
    companyId,
    accountKey,
    firstName,
    lastName,
    role,
    passwordHash: await hashPassword(password),
    emailVerified: false,
    status: 'active',
    verifyTokenHash: hashToken(code),
    verifyExpiresAt: Date.now() + VERIFY_TTL_MS,
    failedLogins: 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await putIdentity(identity);

  await sendTemplateEmail('verifyCode', email, { code });

  // Never leak whether the code "sent" vs previewed; the client just prompts for it.
  return NextResponse.json({ ok: true, needsVerify: true, email });
}
