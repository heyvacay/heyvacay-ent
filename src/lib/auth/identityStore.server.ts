import 'server-only';

/**
 * Enterprise identity store — the real credential record, one item per email.
 *
 * This is the first *account* datastore in the ENT app (the integration token
 * store holds OAuth tokens; the workspace table holds company data). Credentials
 * genuinely must live server-side and survive restarts: a login on one container
 * must verify a password set on another, and a reset emailed now must still be
 * redeemable in an hour.
 *
 * Backing store: a single DynamoDB table, partition key `pk` = the lowercased
 * email. The ENT ECS task role is granted Get/Put/Delete on just this table.
 * When DynamoDB is unconfigured/unreachable (local dev, build, missing IAM) we
 * fall back to an in-process Map so nothing crashes — identities just don't
 * survive a restart in that mode, which is fine for local work.
 *
 * Tokens (verify / reset) are stored ONLY as HMAC hashes, never in the clear, so
 * a leaked table row can't be used to take over an account.
 */

import { IDENTITIES_TABLE, AWS_REGION } from '@/lib/config.server';

export type IdentityStatus = 'active' | 'invited' | 'disabled';

export interface Identity {
  /** Lowercased, trimmed email — the partition key. */
  email: string;
  /** Workspace user id this login resolves to. */
  userId: string;
  /** Workspace / account id (the ENT "company"). */
  companyId: string;
  /** Browser workspace key the account is stored under (demo vs. hv_ent_acct_*). */
  accountKey?: string;
  firstName: string;
  lastName: string;
  /** Workspace role string (admin / super_admin / traveler / …). */
  role: string;
  /** scrypt hash; empty while an invited user hasn't set a password yet. */
  passwordHash: string;
  emailVerified: boolean;
  status: IdentityStatus;
  /** HMAC hash of the outstanding email-verification token + its expiry (ms). */
  verifyTokenHash?: string;
  verifyExpiresAt?: number;
  /** HMAC hash of the outstanding password-reset token + its expiry (ms). */
  resetTokenHash?: string;
  resetExpiresAt?: number;
  /** Consecutive failed logins, and a lock expiry (ms) once the cap is hit. */
  failedLogins?: number;
  lockedUntil?: number;
  createdAt: string;
  updatedAt: string;
}

/** Canonical key form for an email. */
export function emailKey(email: string): string {
  return (email || '').trim().toLowerCase();
}

/* ------------------------------------------------------------------ */
/* In-process fallback (local dev / build / no IAM)                   */
/* ------------------------------------------------------------------ */

const mem: Map<string, Identity> = (() => {
  const g = globalThis as unknown as { __hvEntIdentities?: Map<string, Identity> };
  if (!g.__hvEntIdentities) g.__hvEntIdentities = new Map();
  return g.__hvEntIdentities;
})();

/* ------------------------------------------------------------------ */
/* DynamoDB document client (lazy — only if the SDK is installed)      */
/* ------------------------------------------------------------------ */

type DocClient = {
  get: (args: unknown) => Promise<{ Item?: Record<string, unknown> }>;
  put: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
};

let docClientPromise: Promise<DocClient | null> | null = null;

async function getDocClient(): Promise<DocClient | null> {
  if (!IDENTITIES_TABLE) return null;
  if (docClientPromise) return docClientPromise;
  docClientPromise = (async () => {
    try {
      const [{ DynamoDBClient }, lib] = await Promise.all([
        import('@aws-sdk/client-dynamodb'),
        import('@aws-sdk/lib-dynamodb'),
      ]);
      const base = new DynamoDBClient({ region: AWS_REGION });
      const doc = lib.DynamoDBDocumentClient.from(base, {
        marshallOptions: { removeUndefinedValues: true },
      });
      return {
        get: (args: unknown) =>
          doc.send(new lib.GetCommand(args as never)) as Promise<{
            Item?: Record<string, unknown>;
          }>,
        put: (args: unknown) => doc.send(new lib.PutCommand(args as never)),
        delete: (args: unknown) => doc.send(new lib.DeleteCommand(args as never)),
      };
    } catch (err) {
      console.warn(
        '[auth] DynamoDB unavailable, using in-memory identity store:',
        (err as Error)?.message,
      );
      return null;
    }
  })();
  return docClientPromise;
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export async function getIdentity(email: string): Promise<Identity | null> {
  const key = emailKey(email);
  if (!key) return null;
  const doc = await getDocClient();
  if (!doc) return mem.get(key) ?? null;
  try {
    const res = await doc.get({ TableName: IDENTITIES_TABLE, Key: { pk: key } });
    if (!res.Item) return mem.get(key) ?? null;
    const { pk: _pk, ...rest } = res.Item as Record<string, unknown>;
    void _pk;
    return rest as unknown as Identity;
  } catch (err) {
    console.error('[auth] getIdentity failed:', (err as Error)?.message);
    return mem.get(key) ?? null;
  }
}

export async function putIdentity(identity: Identity): Promise<Identity> {
  const key = emailKey(identity.email);
  const record: Identity = {
    ...identity,
    email: key,
    updatedAt: new Date().toISOString(),
  };
  mem.set(key, record);
  const doc = await getDocClient();
  if (doc) {
    try {
      await doc.put({ TableName: IDENTITIES_TABLE, Item: { pk: key, ...record } });
    } catch (err) {
      console.error('[auth] putIdentity failed:', (err as Error)?.message);
    }
  }
  return record;
}

/** Shallow-merge a patch onto an existing identity and persist it. */
export async function patchIdentity(
  email: string,
  patch: Partial<Identity>,
): Promise<Identity | null> {
  const existing = await getIdentity(email);
  if (!existing) return null;
  return putIdentity({ ...existing, ...patch });
}

export async function deleteIdentity(email: string): Promise<void> {
  const key = emailKey(email);
  mem.delete(key);
  const doc = await getDocClient();
  if (!doc) return;
  try {
    await doc.delete({ TableName: IDENTITIES_TABLE, Key: { pk: key } });
  } catch (err) {
    console.error('[auth] deleteIdentity failed:', (err as Error)?.message);
  }
}
