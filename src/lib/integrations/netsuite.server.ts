import 'server-only';

/**
 * NetSuite integration — per-company Token-Based Auth (OAuth 1.0a, HMAC-SHA256).
 * The admin pastes the 5 TBA values (account id + consumer key/secret + token
 * id/secret). We read the chart of accounts via SuiteQL and post approved
 * expenses as Journal Entries (debit the mapped expense account, credit the
 * chosen payable/bank account). No shared app, so no server secrets / IaC.
 */

import { createHmac, randomBytes } from 'crypto';
import {
  getConnection,
  putConnection,
  patchConnection,
  deleteConnection,
  type IntegrationConnection,
} from './tokenStore.server';
import type { ApiKeyField } from './roster.server';

const PROVIDER = 'netsuite' as const;

export const NETSUITE_FIELDS: ApiKeyField[] = [
  { key: 'accountId', label: 'Account ID', placeholder: 'e.g. 1234567 or 1234567_SB1' },
  { key: 'consumerKey', label: 'Consumer key', type: 'password' },
  { key: 'consumerSecret', label: 'Consumer secret', type: 'password' },
  { key: 'tokenId', label: 'Token ID', type: 'password' },
  { key: 'tokenSecret', label: 'Token secret', type: 'password' },
];

function pctEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/** NetSuite REST host from an account id (handles _SB1 sandbox form). */
function hostFor(accountId: string): string {
  return `${accountId.toLowerCase().replace(/_/g, '-')}.suitetalk.api.netsuite.com`;
}

interface Tba {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
}

function authHeader(tba: Tba, method: string, url: string): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: tba.consumerKey,
    oauth_token: tba.tokenId,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_version: '1.0',
  };
  // Signature base excludes the realm but includes query params from the URL.
  const u = new URL(url);
  const params: Record<string, string> = { ...oauth };
  u.searchParams.forEach((v, k) => (params[k] = v));
  const baseUrl = `${u.origin}${u.pathname}`;
  const paramStr = Object.keys(params)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(params[k])}`)
    .join('&');
  const baseString = `${method.toUpperCase()}&${pctEncode(baseUrl)}&${pctEncode(paramStr)}`;
  const signingKey = `${pctEncode(tba.consumerSecret)}&${pctEncode(tba.tokenSecret)}`;
  const signature = createHmac('sha256', signingKey).update(baseString).digest('base64');
  const header: Record<string, string> = {
    ...oauth,
    oauth_signature: signature,
  };
  const parts = Object.keys(header)
    .map((k) => `${pctEncode(k)}="${pctEncode(header[k])}"`)
    .join(', ');
  return `OAuth realm="${tba.accountId.toUpperCase()}", ${parts}`;
}

async function suiteql(tba: Tba, q: string): Promise<Record<string, unknown>[]> {
  const url = `https://${hostFor(tba.accountId)}/services/rest/query/v1/suiteql?limit=1000`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(tba, 'POST', url),
      'Content-Type': 'application/json',
      Prefer: 'transient',
      Accept: 'application/json',
    },
    body: JSON.stringify({ q }),
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) throw new Error('NetSuite rejected the token (check the 5 TBA values).');
  if (!res.ok) throw new Error(`NetSuite SuiteQL ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = (await res.json().catch(() => null)) as { items?: Record<string, unknown>[] } | null;
  return data?.items ?? [];
}

function credsOf(conn: IntegrationConnection): Tba {
  const c = conn.config || {};
  return {
    accountId: c.accountId || '',
    consumerKey: c.consumerKey || '',
    consumerSecret: c.consumerSecret || '',
    tokenId: c.tokenId || '',
    tokenSecret: c.tokenSecret || '',
  };
}

/** Validate TBA creds with a trivial query, then store the connection. */
export async function connect(companyId: string, creds: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  for (const f of NETSUITE_FIELDS) if (!creds[f.key]?.trim()) return { ok: false, error: `${f.label} is required.` };
  const tba = creds as unknown as Tba;
  try {
    await suiteql(tba, 'SELECT id FROM account WHERE rownum = 1');
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  const existing = await getConnection(companyId, PROVIDER);
  const conn: IntegrationConnection = {
    companyId,
    provider: PROVIDER,
    accessToken: '',
    refreshToken: '',
    accessExpiresAt: 0,
    companyName: `NetSuite ${creds.accountId}`,
    config: creds,
    accountMap: existing?.accountMap,
    paymentAccountId: existing?.paymentAccountId,
    status: 'connected',
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putConnection(conn);
  return { ok: true };
}

export async function listAccounts(companyId: string): Promise<{
  expense: Array<{ id: string; name: string; type: string; subType?: string }>;
  payment: Array<{ id: string; name: string; type: string }>;
}> {
  const conn = await getConnection(companyId, PROVIDER);
  if (!conn || conn.status !== 'connected') throw new Error('NetSuite is not connected for this company.');
  const rows = await suiteql(
    credsOf(conn),
    "SELECT id, acctname, accttype FROM account WHERE isinactive = 'F'"
  );
  const expenseTypes = ['Expense', 'OthExpense', 'COGS', 'DeferExpense'];
  const paymentTypes = ['Bank', 'CredCard'];
  const expense = rows
    .filter((r) => expenseTypes.includes(String(r.accttype)))
    .map((r) => ({ id: String(r.id), name: String(r.acctname), type: String(r.accttype), subType: String(r.accttype) }));
  const payment = rows
    .filter((r) => paymentTypes.includes(String(r.accttype)))
    .map((r) => ({ id: String(r.id), name: String(r.acctname), type: String(r.accttype) }));
  return { expense, payment };
}

export async function saveMapping(
  companyId: string,
  accountMap?: Record<string, string>,
  paymentAccountId?: string
): Promise<IntegrationConnection | null> {
  return patchConnection(companyId, PROVIDER, {
    ...(accountMap ? { accountMap } : {}),
    ...(paymentAccountId !== undefined ? { paymentAccountId } : {}),
  });
}

export interface PostInput {
  expenseId: string;
  expenseAccountId: string;
  paymentAccountId: string;
  amount: number;
  txnDate: string; // YYYY-MM-DD
  merchant: string;
  description?: string;
}

/** Post an expense as a NetSuite Journal Entry (debit expense, credit payment). */
export async function postJournalEntry(
  companyId: string,
  input: PostInput
): Promise<{ id: string; ok: boolean; error?: string }> {
  const conn = await getConnection(companyId, PROVIDER);
  if (!conn || conn.status !== 'connected') throw new Error('NetSuite is not connected for this company.');
  const tba = credsOf(conn);
  const amount = Number(input.amount.toFixed(2));
  const url = `https://${hostFor(tba.accountId)}/services/rest/record/v1/journalEntry`;
  const body = {
    tranDate: input.txnDate,
    memo: `HeyVacay HV-${input.expenseId} — ${input.merchant}${input.description ? ` · ${input.description}` : ''}`.slice(0, 999),
    line: {
      items: [
        { account: { id: input.expenseAccountId }, debit: amount, memo: input.merchant },
        { account: { id: input.paymentAccountId }, credit: amount, memo: input.merchant },
      ],
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(tba, 'POST', url),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (res.status === 204 || res.ok) {
    // NetSuite returns the new record id in the Location header.
    const loc = res.headers.get('location') || '';
    const id = loc.split('/').pop() || '';
    return { id, ok: true };
  }
  return { id: '', ok: false, error: `${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
}

export async function status(companyId: string) {
  const conn = await getConnection(companyId, PROVIDER);
  return {
    connected: conn?.status === 'connected',
    label: conn?.companyName || null,
    accountMap: conn?.accountMap || {},
    paymentAccountId: conn?.paymentAccountId || null,
    fields: NETSUITE_FIELDS,
  };
}

export async function disconnect(companyId: string): Promise<void> {
  await deleteConnection(companyId, PROVIDER);
}
