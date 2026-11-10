import 'server-only';

/**
 * QuickBooks Online integration — real OAuth2 + Accounting API.
 *
 * Flow:
 *   1. buildAuthorizeUrl(companyId)  -> Intuit consent screen (state = signed companyId)
 *   2. exchangeCode(code, realmId, state) -> tokens, fetch company name, persist
 *   3. getValidAccessToken(companyId) -> fresh bearer, auto-refreshing when near expiry
 *   4. listAccounts(companyId) -> chart of accounts (to map categories -> GL accounts)
 *   5. createPurchase(companyId, {...}) -> posts an approved expense as a QBO Purchase
 *
 * All calls go straight to Intuit from the ENT server (ECS). Keys never touch
 * the browser. Tokens persist in the integration token store (DynamoDB).
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { QUICKBOOKS, OAUTH_STATE_SECRET } from '@/lib/config.server';
import {
  getConnection,
  putConnection,
  patchConnection,
  type IntegrationConnection,
} from './tokenStore.server';

const PROVIDER = 'quickbooks' as const;
/** Refresh the access token when it's within this window of expiring. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Signed OAuth state (so the callback can trust the company id)      */
/* ------------------------------------------------------------------ */

function b64url(s: string): string {
  return Buffer.from(s).toString('base64url');
}

export function signState(companyId: string): string {
  const payload = b64url(
    JSON.stringify({ c: companyId, t: Date.now(), n: Math.random().toString(36).slice(2) })
  );
  const sig = createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Returns the companyId if the state is valid and < 1h old, else null. */
export function verifyState(state: string): string | null {
  try {
    const [payload, sig] = String(state).split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', OAUTH_STATE_SECRET)
      .update(payload)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.c || typeof data.t !== 'number') return null;
    if (Date.now() - data.t > 60 * 60 * 1000) return null; // 1h TTL
    return String(data.c);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Authorize URL                                                       */
/* ------------------------------------------------------------------ */

export function buildAuthorizeUrl(companyId: string): string {
  const params = new URLSearchParams({
    client_id: QUICKBOOKS.clientId,
    response_type: 'code',
    scope: QUICKBOOKS.scope,
    redirect_uri: QUICKBOOKS.redirectUri,
    state: signState(companyId),
  });
  return `${QUICKBOOKS.authorizeUrl}?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Token exchange + refresh                                            */
/* ------------------------------------------------------------------ */

function basicAuthHeader(): string {
  const raw = `${QUICKBOOKS.clientId}:${QUICKBOOKS.clientSecret}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type: string;
}

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(QUICKBOOKS.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(body).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`QuickBooks token request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as TokenResponse;
}

/**
 * Exchange an authorization code for tokens, fetch the company name, and
 * persist the connection. Returns the stored connection.
 */
export async function exchangeCode(
  companyId: string,
  code: string,
  realmId: string
): Promise<IntegrationConnection> {
  const tok = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: QUICKBOOKS.redirectUri,
  });
  const now = Date.now();
  const existing = await getConnection(companyId, PROVIDER);
  const conn: IntegrationConnection = {
    companyId,
    provider: PROVIDER,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    accessExpiresAt: now + tok.expires_in * 1000,
    refreshExpiresAt: tok.x_refresh_token_expires_in
      ? now + tok.x_refresh_token_expires_in * 1000
      : undefined,
    realmId,
    accountMap: existing?.accountMap,
    paymentAccountId: existing?.paymentAccountId,
    defaultVendorId: existing?.defaultVendorId,
    status: 'connected',
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  // Best-effort company name for display.
  try {
    const info = await getCompanyInfo(conn.accessToken, realmId);
    conn.companyName = info?.CompanyName || info?.LegalName;
  } catch {
    /* non-fatal */
  }
  await putConnection(conn);
  return conn;
}

async function refreshTokens(conn: IntegrationConnection): Promise<IntegrationConnection> {
  const tok = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: conn.refreshToken,
  });
  const now = Date.now();
  const updated = await patchConnection(conn.companyId, PROVIDER, {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || conn.refreshToken,
    accessExpiresAt: now + tok.expires_in * 1000,
    refreshExpiresAt: tok.x_refresh_token_expires_in
      ? now + tok.x_refresh_token_expires_in * 1000
      : conn.refreshExpiresAt,
    status: 'connected',
  });
  return updated ?? conn;
}

/**
 * Return a valid access token for the company, refreshing if it's expired or
 * about to expire. Throws if the company isn't connected or the refresh fails.
 */
export async function getValidAccessToken(
  companyId: string
): Promise<{ accessToken: string; realmId: string; conn: IntegrationConnection }> {
  const conn = await getConnection(companyId, PROVIDER);
  if (!conn || conn.status === 'revoked') {
    throw new Error('QuickBooks is not connected for this company.');
  }
  if (Date.now() < conn.accessExpiresAt - REFRESH_SKEW_MS) {
    return { accessToken: conn.accessToken, realmId: conn.realmId, conn };
  }
  try {
    const refreshed = await refreshTokens(conn);
    return { accessToken: refreshed.accessToken, realmId: refreshed.realmId, conn: refreshed };
  } catch (err) {
    await patchConnection(companyId, PROVIDER, { status: 'error' });
    throw new Error(
      `QuickBooks session expired and could not be refreshed — reconnect required. (${(err as Error).message})`
    );
  }
}

/* ------------------------------------------------------------------ */
/* Accounting API helpers                                              */
/* ------------------------------------------------------------------ */

async function qboFetch(
  accessToken: string,
  realmId: string,
  path: string,
  init?: RequestInit
): Promise<unknown> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${QUICKBOOKS.apiBase}/v3/company/${realmId}/${path}${sep}minorversion=${QUICKBOOKS.minorVersion}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`QuickBooks API ${res.status} on ${path}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

interface CompanyInfo {
  CompanyName?: string;
  LegalName?: string;
}

export async function getCompanyInfo(
  accessToken: string,
  realmId: string
): Promise<CompanyInfo | null> {
  const data = (await qboFetch(
    accessToken,
    realmId,
    `companyinfo/${realmId}`
  )) as { CompanyInfo?: CompanyInfo };
  return data?.CompanyInfo ?? null;
}

export interface QboAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  Classification?: string;
}

/** Fetch the active chart of accounts (for mapping categories -> GL accounts). */
export async function listAccounts(companyId: string): Promise<QboAccount[]> {
  const { accessToken, realmId } = await getValidAccessToken(companyId);
  const query =
    'select Id, Name, AccountType, AccountSubType, Classification from Account where Active = true maxresults 1000';
  const data = (await qboFetch(
    accessToken,
    realmId,
    `query?query=${encodeURIComponent(query)}`
  )) as { QueryResponse?: { Account?: QboAccount[] } };
  return data?.QueryResponse?.Account ?? [];
}

export interface CreatePurchaseInput {
  /** Expense GL account id (AccountBasedExpenseLineDetail.AccountRef). */
  expenseAccountId: string;
  /** Bank / credit-card account the purchase is paid from (Purchase.AccountRef). */
  paymentAccountId: string;
  amount: number;
  /** YYYY-MM-DD */
  txnDate: string;
  merchant: string;
  description?: string;
  /** "CreditCard" (company card) or "Cash" (personal / reimbursable). */
  paymentType?: 'CreditCard' | 'Cash';
  vendorId?: string;
}

export interface CreatePurchaseResult {
  id: string;
  docNumber?: string;
  viewUrl: string;
}

/** Post an approved expense to QuickBooks as a Purchase. */
export async function createPurchase(
  companyId: string,
  input: CreatePurchaseInput
): Promise<CreatePurchaseResult> {
  const { accessToken, realmId } = await getValidAccessToken(companyId);
  const body: Record<string, unknown> = {
    PaymentType: input.paymentType || 'CreditCard',
    AccountRef: { value: input.paymentAccountId },
    TxnDate: input.txnDate,
    PrivateNote: `HeyVacay expense — ${input.merchant}${input.description ? ` · ${input.description}` : ''}`,
    Line: [
      {
        Amount: Number(input.amount.toFixed(2)),
        DetailType: 'AccountBasedExpenseLineDetail',
        Description: `${input.merchant}${input.description ? ` — ${input.description}` : ''}`.slice(0, 1000),
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: input.expenseAccountId },
        },
      },
    ],
  };
  if (input.vendorId) {
    body.EntityRef = { value: input.vendorId, type: 'Vendor' };
  }
  const data = (await qboFetch(accessToken, realmId, 'purchase', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as { Purchase?: { Id: string; DocNumber?: string } };
  const id = data?.Purchase?.Id || '';
  // Deep link to view the transaction in QBO (sandbox vs prod host).
  const host =
    QUICKBOOKS.env === 'production'
      ? 'https://app.qbo.intuit.com'
      : 'https://app.sandbox.qbo.intuit.com';
  return {
    id,
    docNumber: data?.Purchase?.DocNumber,
    viewUrl: `${host}/app/exprs?txnId=${id}`,
  };
}
