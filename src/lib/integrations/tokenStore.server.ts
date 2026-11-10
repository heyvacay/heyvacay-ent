import 'server-only';

/**
 * Per-company integration connection store.
 *
 * This is the ENTERPRISE app's first real server-side datastore — everything
 * else is per-browser localStorage. OAuth tokens genuinely need to live here:
 * an expense is approved now and posts to QuickBooks later (a different request,
 * possibly a different container), so the access/refresh tokens must persist
 * across requests and restarts, and the access token has to be refreshed on a
 * schedule the browser can't drive.
 *
 * Backing store: a single DynamoDB table, partition key `pk` = `${companyId}#${provider}`.
 * The ENT ECS task role is granted GetItem/PutItem/DeleteItem on just this table.
 * When DynamoDB is unconfigured or unreachable (local dev, build, missing IAM),
 * we fall back to an in-process Map so nothing crashes — tokens simply don't
 * survive a restart in that mode, which is fine for local work.
 */

import { INTEGRATIONS_TABLE, AWS_REGION } from '@/lib/config.server';

export type IntegrationProvider = 'quickbooks';

export interface IntegrationConnection {
  companyId: string;
  provider: IntegrationProvider;
  /** OAuth access token (short-lived; refreshed automatically). */
  accessToken: string;
  /** OAuth refresh token (long-lived). */
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  accessExpiresAt: number;
  /** Epoch ms when the refresh token expires (QBO ~100 days). */
  refreshExpiresAt?: number;
  /** QuickBooks company (realm) id the tokens are scoped to. */
  realmId: string;
  /** Human-friendly company name, fetched once at connect for display. */
  companyName?: string;
  /** Category -> QuickBooks expense Account id (the GL account each posts to). */
  accountMap?: Record<string, string>;
  /** The QBO bank/credit-card Account id purchases are paid from. */
  paymentAccountId?: string;
  /** Default QBO Vendor id used when an expense has no matched vendor. */
  defaultVendorId?: string;
  status: 'connected' | 'revoked' | 'error';
  connectedAt: string;
  updatedAt: string;
}

const pk = (companyId: string, provider: IntegrationProvider) =>
  `${companyId}#${provider}`;

/* ------------------------------------------------------------------ */
/* In-process fallback (local dev / build / no IAM)                    */
/* ------------------------------------------------------------------ */

// Survives hot-reload within a single Node process via globalThis.
const mem: Map<string, IntegrationConnection> = (() => {
  const g = globalThis as unknown as {
    __hvEntIntegrations?: Map<string, IntegrationConnection>;
  };
  if (!g.__hvEntIntegrations) g.__hvEntIntegrations = new Map();
  return g.__hvEntIntegrations;
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
  if (!INTEGRATIONS_TABLE) return null;
  if (docClientPromise) return docClientPromise;
  docClientPromise = (async () => {
    try {
      // Dynamic import so the app builds/runs even if the AWS SDK isn't present
      // (e.g. a trimmed local install). Resolved once, cached.
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
        delete: (args: unknown) =>
          doc.send(new lib.DeleteCommand(args as never)),
      };
    } catch (err) {
      console.warn(
        '[integrations] DynamoDB unavailable, using in-memory token store:',
        (err as Error)?.message
      );
      return null;
    }
  })();
  return docClientPromise;
}

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export async function getConnection(
  companyId: string,
  provider: IntegrationProvider
): Promise<IntegrationConnection | null> {
  if (!companyId) return null;
  const key = pk(companyId, provider);
  const doc = await getDocClient();
  if (!doc) return mem.get(key) ?? null;
  try {
    const res = await doc.get({
      TableName: INTEGRATIONS_TABLE,
      Key: { pk: key },
    });
    if (!res.Item) return null;
    // Stored flat; `pk` is the only synthetic field.
    const { pk: _pk, ...rest } = res.Item as Record<string, unknown>;
    void _pk;
    return rest as unknown as IntegrationConnection;
  } catch (err) {
    console.error('[integrations] getConnection failed:', (err as Error)?.message);
    // Fall back to memory so a transient DDB error doesn't look "disconnected".
    return mem.get(key) ?? null;
  }
}

export async function putConnection(
  conn: IntegrationConnection
): Promise<void> {
  const key = pk(conn.companyId, conn.provider);
  const record: IntegrationConnection = { ...conn, updatedAt: new Date().toISOString() };
  mem.set(key, record);
  const doc = await getDocClient();
  if (!doc) return;
  try {
    await doc.put({
      TableName: INTEGRATIONS_TABLE,
      Item: { pk: key, ...record },
    });
  } catch (err) {
    console.error('[integrations] putConnection failed:', (err as Error)?.message);
    // Keep the in-memory copy; surface nothing to the caller (best-effort).
  }
}

export async function deleteConnection(
  companyId: string,
  provider: IntegrationProvider
): Promise<void> {
  const key = pk(companyId, provider);
  mem.delete(key);
  const doc = await getDocClient();
  if (!doc) return;
  try {
    await doc.delete({ TableName: INTEGRATIONS_TABLE, Key: { pk: key } });
  } catch (err) {
    console.error('[integrations] deleteConnection failed:', (err as Error)?.message);
  }
}

/** Shallow-merge a patch onto an existing connection and persist it. */
export async function patchConnection(
  companyId: string,
  provider: IntegrationProvider,
  patch: Partial<IntegrationConnection>
): Promise<IntegrationConnection | null> {
  const existing = await getConnection(companyId, provider);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  await putConnection(merged);
  return merged;
}
