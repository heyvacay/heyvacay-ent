import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Clear the session cookie. */
export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
