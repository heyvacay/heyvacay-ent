import { NextResponse } from 'next/server';
import { hashPassword, verifyPassword, passwordProblem } from '@/lib/auth/password.server';
import { getIdentity, patchIdentity } from '@/lib/auth/identityStore.server';
import { getSession } from '@/lib/auth/session.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Change password while signed in. Requires a valid session and the current
 * password. Body: { currentPassword, newPassword }.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const currentPassword = String(body.currentPassword ?? '');
  const newPassword = String(body.newPassword ?? '');

  const pwErr = passwordProblem(newPassword);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  const identity = await getIdentity(session.email);
  if (!identity || !identity.passwordHash) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  const ok = await verifyPassword(currentPassword, identity.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 403 });
  }

  await patchIdentity(session.email, { passwordHash: await hashPassword(newPassword) });
  return NextResponse.json({ ok: true });
}
