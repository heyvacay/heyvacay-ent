import 'server-only';

/**
 * Xero integration — real OAuth2 + Accounting API (same shape as QuickBooks).
 *
 *   1. buildAuthorizeUrl(companyId)  -> Xero consent screen (signed state)
 *   2. exchangeCode(companyId, code) -> tokens + tenant (organisation), persisted
 *   3. getValidAccessToken(companyId) -> fresh bearer, auto-refreshing
 *   4. listAccounts(companyId) -> chart of accounts (expense codes + bank accounts)
 *   5. createSpend(companyId, {...}) -> posts an expense as a SPEND bank transaction
 *
 * Note on identifiers: Xero line items reference an account by its CODE, while a
 * bank account is referenced by its AccountID (GUID). So listAccounts returns
 * expense options keyed by Code and payment options keyed by AccountID, and the
 * mapping stores exactly what each call needs.
 */

import { XERO } from '@/lib/config.server';
import { signState, verifyState } from './oauthState.server';
import {
  getConnection,
  putConnection,
  patchConnection,
  type IntegrationConnection,
} from './tokenStore.server';

const PROVIDER = 'xero' as const;
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export { verifyState };

export function buildAuthorizeUrl(companyId: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: XERO.clientId,
    redirect_uri: XERO.redirectUri,
    scope: XERO.scope,
    state: signState(companyId, PROVIDER),
  });
  return `${XERO.authorizeUrl}?${params.toString()}`;
}

function basicAuth(): string {
  return `Basic ${Buffer.from(`${XERO.clientId}:${XERO.clientSecret}`).toString('base64')}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(XERO.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xero token request failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text) as TokenResponse;
}

interface XeroTenant {
  tenantId: string;
  tenantName?: string;
  tenantType?: string;
}

async function fetchTenants(accessToken: string): Promise<XeroTenant[]> {
  const res = await fetch(`${XERO.apiBase}/connections`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as XeroTenant[] | null;
  return Array.isArray(data) ? data : [];
}

export async function exchangeCode(companyId: string, code: string): Promise<IntegrationConnection> {
  const tok = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: XERO.redirectUri,
  });
  const now = Date.now();
  const tenants = await fetchTenants(tok.access_token);
  // Prefer an ORGANISATION tenant; fall back to the first.
  const tenant = tenants.find((t) => t.tenantType === 'ORGANISATION') || tenants[0];
  const existing = await getConnection(companyId, PROVIDER);
  const conn: IntegrationConnection = {
    companyId,
    provider: PROVIDER,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    accessExpiresAt: now + tok.expires_in * 1000,
    tenantId: tenant?.tenantId,
    companyName: tenant?.tenantName,
    accountMap: existing?.accountMap,
    paymentAccountId: existing?.paymentAccountId,
    status: tenant?.tenantId ? 'connected' : 'error',
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putConnection(conn);
  return conn;
}

async function refreshTokens(conn: IntegrationConnection): Promise<IntegrationConnection> {
  const tok = await requestToken({ grant_type: 'refresh_token', refresh_token: conn.refreshToken });
  const now = Date.now();
  const updated = await patchConnection(conn.companyId, PROVIDER, {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || conn.refreshToken,
    accessExpiresAt: now + tok.expires_in * 1000,
    status: 'connected',
  });
  return updated ?? conn;
}

export async function getValidAccessToken(
  companyId: string
): Promise<{ accessToken: string; tenantId: string }> {
  const conn = await getConnection(companyId, PROVIDER);
  if (!conn || conn.status === 'revoked' || !conn.tenantId) {
    throw new Error('Xero is not connected for this company.');
  }
  if (Date.now() < conn.accessExpiresAt - REFRESH_SKEW_MS) {
    return { accessToken: conn.accessToken, tenantId: conn.tenantId };
  }
  try {
    const refreshed = await refreshTokens(conn);
    return { accessToken: refreshed.accessToken, tenantId: refreshed.tenantId || conn.tenantId };
  } catch (err) {
    await patchConnection(companyId, PROVIDER, { status: 'error' });
    throw new Error(`Xero session expired and could not be refreshed — reconnect required. (${(err as Error).message})`);
  }
}

async function xeroFetch(
  companyId: string,
  path: string,
  init?: RequestInit
): Promise<unknown> {
  const { accessToken, tenantId } = await getValidAccessToken(companyId);
  const res = await fetch(`${XERO.apiBase}/api.xro/2.0/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-Tenant-Id': tenantId,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xero API ${res.status} on ${path}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

export interface XeroAccount {
  AccountID: string;
  Code?: string;
  Name: string;
  Type: string; // BANK, EXPENSE, OVERHEADS, …
  Class?: string; // ASSET, EXPENSE, LIABILITY, …
  BankAccountNumber?: string;
}

/** Expense accounts (keyed by Code) + bank/payment accounts (keyed by AccountID). */
export async function listAccounts(companyId: string): Promise<{
  expense: Array<{ id: string; name: string; type: string; subType?: string }>;
  payment: Array<{ id: string; name: string; type: string }>;
}> {
  const data = (await xeroFetch(companyId, 'Accounts')) as { Accounts?: XeroAccount[] };
  const accounts = data?.Accounts ?? [];
  const expense = accounts
    .filter((a) => (a.Class === 'EXPENSE' || ['EXPENSE', 'OVERHEADS', 'DIRECTCOSTS'].includes(a.Type)) && a.Code)
    .map((a) => ({ id: a.Code as string, name: a.Name, type: a.Type, subType: a.Type }));
  const payment = accounts
    .filter((a) => a.Type === 'BANK')
    .map((a) => ({ id: a.AccountID, name: a.Name, type: 'Bank' }));
  return { expense, payment };
}

export function referenceFor(expenseId: string): string {
  return `HV-${expenseId}`;
}

function viewUrlFor(id: string): string {
  return `https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=${id}`;
}

async function findByReference(
  companyId: string,
  reference: string
): Promise<{ id: string } | null> {
  const where = encodeURIComponent(`Reference=="${reference.replace(/"/g, '')}"`);
  const data = (await xeroFetch(companyId, `BankTransactions?where=${where}`)) as {
    BankTransactions?: Array<{ BankTransactionID: string }>;
  };
  const hit = data?.BankTransactions?.[0];
  return hit ? { id: hit.BankTransactionID } : null;
}

export interface CreateSpendInput {
  expenseId: string;
  /** Expense account CODE (from listAccounts expense option id). */
  expenseAccountCode: string;
  /** Bank account AccountID (from listAccounts payment option id). */
  paymentAccountId: string;
  amount: number;
  txnDate: string; // YYYY-MM-DD
  merchant: string;
  description?: string;
}

export interface CreateSpendResult {
  id: string;
  reference: string;
  viewUrl: string;
  verified: boolean;
  verifyNote?: string;
  duplicate?: boolean;
}

/** Post an approved expense to Xero as a SPEND bank transaction (idempotent + verified). */
export async function createSpend(
  companyId: string,
  input: CreateSpendInput
): Promise<CreateSpendResult> {
  const reference = referenceFor(input.expenseId);
  const amount = Number(input.amount.toFixed(2));

  const existing = await findByReference(companyId, reference);
  if (existing) {
    return { id: existing.id, reference, viewUrl: viewUrlFor(existing.id), verified: true, duplicate: true };
  }

  const body = {
    Type: 'SPEND',
    Reference: reference,
    Date: input.txnDate,
    LineAmountTypes: 'NoTax',
    BankAccount: { AccountID: input.paymentAccountId },
    LineItems: [
      {
        Description: `${input.merchant}${input.description ? ` — ${input.description}` : ''}`.slice(0, 4000),
        Quantity: 1,
        UnitAmount: amount,
        AccountCode: input.expenseAccountCode,
      },
    ],
  };
  const data = (await xeroFetch(companyId, 'BankTransactions', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as {
    BankTransactions?: Array<{
      BankTransactionID: string;
      Total?: number;
      LineItems?: Array<{ AccountCode?: string }>;
    }>;
  };
  const tx = data?.BankTransactions?.[0];
  const id = tx?.BankTransactionID || '';

  const issues: string[] = [];
  if (typeof tx?.Total === 'number' && Math.abs(tx.Total - amount) > 0.005) {
    issues.push(`amount posted as ${tx.Total}, expected ${amount}`);
  }
  const postedCode = tx?.LineItems?.[0]?.AccountCode;
  if (postedCode && postedCode !== input.expenseAccountCode) {
    issues.push('posted to a different account than mapped');
  }

  return {
    id,
    reference,
    viewUrl: viewUrlFor(id),
    verified: issues.length === 0,
    verifyNote: issues.length ? issues.join('; ') : undefined,
  };
}
