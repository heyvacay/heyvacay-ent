import 'server-only';

/**
 * Expensify integration — per-company Integration Server credentials
 * (partnerUserID + partnerUserSecret). We validate by listing the account's
 * policies; once connected, the policy list is shown so an admin can confirm
 * the right workspace is linked. No shared app / IaC.
 */

import {
  getConnection,
  putConnection,
  deleteConnection,
  type IntegrationConnection,
} from './tokenStore.server';
import type { ApiKeyField } from './roster.server';

const PROVIDER = 'expensify' as const;
const ENDPOINT = 'https://integrations.expensify.com/Integration-Server/ExpensifyIntegrations';

export const EXPENSIFY_FIELDS: ApiKeyField[] = [
  { key: 'partnerUserID', label: 'Partner User ID', placeholder: 'Expensify partnerUserID' },
  { key: 'partnerUserSecret', label: 'Partner User Secret', type: 'password' },
];

export interface ExpensifyPolicy {
  id: string;
  name: string;
  role?: string;
  type?: string;
}

async function listPolicies(partnerUserID: string, partnerUserSecret: string): Promise<ExpensifyPolicy[]> {
  const job = {
    type: 'get',
    credentials: { partnerUserID, partnerUserSecret },
    inputSettings: { type: 'policyList' },
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ requestJobDescription: JSON.stringify(job) }).toString(),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Expensify ${res.status}: ${text.slice(0, 160)}`);
  let data: { policyList?: ExpensifyPolicy[]; responseMessage?: string } | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Expensify returned an unexpected response: ${text.slice(0, 160)}`);
  }
  if (!data?.policyList) {
    throw new Error(data?.responseMessage || 'Expensify rejected the credentials.');
  }
  return data.policyList;
}

export async function connect(companyId: string, creds: Record<string, string>): Promise<{ ok: boolean; error?: string; count?: number }> {
  for (const f of EXPENSIFY_FIELDS) if (!creds[f.key]?.trim()) return { ok: false, error: `${f.label} is required.` };
  try {
    const policies = await listPolicies(creds.partnerUserID, creds.partnerUserSecret);
    const existing = await getConnection(companyId, PROVIDER);
    const conn: IntegrationConnection = {
      companyId,
      provider: PROVIDER,
      accessToken: '',
      refreshToken: '',
      accessExpiresAt: 0,
      companyName: policies[0]?.name || 'Expensify',
      config: creds,
      status: 'connected',
      connectedAt: existing?.connectedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putConnection(conn);
    return { ok: true, count: policies.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function policies(companyId: string): Promise<ExpensifyPolicy[]> {
  const conn = await getConnection(companyId, PROVIDER);
  if (!conn || conn.status !== 'connected' || !conn.config) throw new Error('Expensify is not connected for this company.');
  return listPolicies(conn.config.partnerUserID, conn.config.partnerUserSecret);
}

export async function status(companyId: string) {
  const conn = await getConnection(companyId, PROVIDER);
  return { connected: conn?.status === 'connected', label: conn?.companyName || null, fields: EXPENSIFY_FIELDS };
}

export async function disconnect(companyId: string): Promise<void> {
  await deleteConnection(companyId, PROVIDER);
}
