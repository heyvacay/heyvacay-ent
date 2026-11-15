import 'server-only';

import type { Identity } from '@/lib/auth/identityStore.server';
import { setSessionCookie } from '@/lib/auth/session.server';

/** The non-secret account shape returned to the client after auth. */
export interface AccountInfo {
  userId: string;
  email: string;
  companyId: string;
  accountKey?: string;
  role: string;
  firstName: string;
  lastName: string;
}

export function accountOf(i: Identity): AccountInfo {
  return {
    userId: i.userId,
    email: i.email,
    companyId: i.companyId,
    accountKey: i.accountKey,
    role: i.role,
    firstName: i.firstName,
    lastName: i.lastName,
  };
}

/** Issue the httpOnly session cookie for a verified identity. */
export async function issueSession(i: Identity): Promise<void> {
  await setSessionCookie({
    sub: i.userId,
    email: i.email,
    companyId: i.companyId,
    accountKey: i.accountKey,
    role: i.role,
    name: `${i.firstName} ${i.lastName}`.trim(),
  });
}
