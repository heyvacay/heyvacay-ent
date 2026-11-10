import 'server-only';

/**
 * BambooHR integration — per-company API key + subdomain, reads the employee
 * directory so an admin can import their roster into HeyVacay.
 *
 * Unlike QuickBooks/Xero there's no shared app: each company pastes its own
 * BambooHR API key (every BambooHR account issues its own), so the key lives in
 * the per-company connection (DynamoDB), not in server secrets. Auth is HTTP
 * Basic with the API key as the username and any password.
 */

import {
  getConnection,
  putConnection,
  deleteConnection,
  type IntegrationConnection,
} from './tokenStore.server';

const PROVIDER = 'bamboohr' as const;

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:x`).toString('base64')}`;
}

function base(subdomain: string): string {
  return `https://api.bamboohr.com/api/gateway.php/${encodeURIComponent(subdomain)}/v1`;
}

export interface BambooEmployee {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  workEmail?: string;
  jobTitle?: string;
  department?: string;
  supervisor?: string;
  supervisorEId?: string;
}

/** Fetch the company directory. Throws with a friendly message on auth failure. */
export async function fetchDirectory(
  subdomain: string,
  apiKey: string
): Promise<BambooEmployee[]> {
  const res = await fetch(`${base(subdomain)}/employees/directory`, {
    headers: { Authorization: authHeader(apiKey), Accept: 'application/json' },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('BambooHR rejected the API key (check the key and subdomain).');
  }
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`BambooHR directory failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = (await res.json().catch(() => null)) as { employees?: BambooEmployee[] } | null;
  return Array.isArray(data?.employees) ? data!.employees! : [];
}

/** Validate creds by hitting the directory, then persist the connection. */
export async function connect(
  companyId: string,
  subdomain: string,
  apiKey: string
): Promise<{ count: number }> {
  const employees = await fetchDirectory(subdomain, apiKey);
  const existing = await getConnection(companyId, PROVIDER);
  const conn: IntegrationConnection = {
    companyId,
    provider: PROVIDER,
    accessToken: apiKey, // API key stored as the connection credential
    refreshToken: '',
    accessExpiresAt: 0,
    companyName: subdomain,
    config: { subdomain },
    status: 'connected',
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putConnection(conn);
  return { count: employees.length };
}

export async function getDirectory(companyId: string): Promise<BambooEmployee[]> {
  const conn = await getConnection(companyId, PROVIDER);
  if (!conn || conn.status !== 'connected' || !conn.config?.subdomain || !conn.accessToken) {
    throw new Error('BambooHR is not connected for this company.');
  }
  return fetchDirectory(conn.config.subdomain, conn.accessToken);
}

export async function disconnect(companyId: string): Promise<void> {
  await deleteConnection(companyId, PROVIDER);
}
