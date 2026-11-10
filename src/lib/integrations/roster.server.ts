import 'server-only';

/**
 * Roster / directory sync providers — one registry behind one set of dynamic
 * routes (/api/integrations/roster/[provider]/…) and one shared UI panel. Each
 * provider normalizes its people to NormPerson so the client import is identical.
 *
 * Two connect styles:
 *  - apikey  : the admin pastes per-company credentials (no shared app, no IaC).
 *              e.g. Rippling, Okta, Workday.
 *  - oauth   : the company authorizes a shared HeyVacay app (needs server
 *              secrets + IaC). e.g. Gusto, Google Workspace.
 */

import { GUSTO, GOOGLE_WS } from '@/lib/config.server';
import { signState, verifyState } from './oauthState.server';
import {
  getConnection,
  putConnection,
  patchConnection,
  deleteConnection,
  type IntegrationConnection,
  type IntegrationProvider,
} from './tokenStore.server';

export interface NormPerson {
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  title: string;
  department: string;
}

export interface ApiKeyField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password';
}

const REFRESH_SKEW_MS = 5 * 60 * 1000;

function person(p: Partial<NormPerson>): NormPerson | null {
  const email = (p.email || '').trim().toLowerCase();
  const name = (p.name || `${p.firstName || ''} ${p.lastName || ''}`).trim();
  if (!email || !name) return null;
  return {
    firstName: p.firstName || '',
    lastName: p.lastName || '',
    name,
    email,
    title: p.title || '',
    department: p.department || '',
  };
}

/** Case-insensitive pick from a flat object by any of the candidate keys. */
function pick(obj: Record<string, unknown>, candidates: string[]): string {
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) lower[k.toLowerCase().replace(/[_\s]/g, '')] = obj[k];
  for (const c of candidates) {
    const v = lower[c.toLowerCase().replace(/[_\s]/g, '')];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* API-key providers                                                   */
/* ------------------------------------------------------------------ */

interface ApiKeyProvider {
  kind: 'apikey';
  fields: ApiKeyField[];
  help?: string;
  /** Validate + fetch; throws a friendly error on bad creds. */
  fetch(creds: Record<string, string>): Promise<{ people: NormPerson[]; label: string }>;
}

const rippling: ApiKeyProvider = {
  kind: 'apikey',
  fields: [{ key: 'apiKey', label: 'API key', type: 'password', placeholder: 'Rippling API key' }],
  help: 'Create an API key in Rippling → Settings → API / Custom integrations.',
  async fetch(creds) {
    const res = await fetch('https://api.rippling.com/platform/api/employees?limit=500', {
      headers: { Authorization: `Bearer ${creds.apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) throw new Error('Rippling rejected the API key.');
    if (!res.ok) throw new Error(`Rippling API ${res.status}`);
    const data = (await res.json().catch(() => null)) as unknown;
    const arr = Array.isArray(data) ? data : ((data as { results?: unknown[] })?.results ?? []);
    const people = (arr as Record<string, unknown>[])
      .map((e) =>
        person({
          firstName: pick(e, ['firstName', 'first_name']),
          lastName: pick(e, ['lastName', 'last_name']),
          email: pick(e, ['workEmail', 'work_email', 'email']),
          title: pick(e, ['title', 'jobTitle', 'job_title']),
          department: pick(e, ['department', 'departmentName']),
        })
      )
      .filter((x): x is NormPerson => !!x);
    return { people, label: 'Rippling' };
  },
};

const okta: ApiKeyProvider = {
  kind: 'apikey',
  fields: [
    { key: 'domain', label: 'Okta domain', placeholder: 'yourco.okta.com' },
    { key: 'apiToken', label: 'API token', type: 'password', placeholder: 'Okta API token (SSWS)' },
  ],
  help: 'Create a token in Okta → Security → API → Tokens.',
  async fetch(creds) {
    const domain = creds.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const res = await fetch(`https://${domain}/api/v1/users?limit=200`, {
      headers: { Authorization: `SSWS ${creds.apiToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) throw new Error('Okta rejected the API token.');
    if (!res.ok) throw new Error(`Okta API ${res.status}`);
    const data = (await res.json().catch(() => null)) as Array<{ profile?: Record<string, unknown> }> | null;
    const people = (data ?? [])
      .map((u) => {
        const p = u.profile || {};
        return person({
          firstName: pick(p, ['firstName']),
          lastName: pick(p, ['lastName']),
          email: pick(p, ['email', 'login']),
          title: pick(p, ['title']),
          department: pick(p, ['department']),
        });
      })
      .filter((x): x is NormPerson => !!x);
    return { people, label: domain };
  },
};

const workday: ApiKeyProvider = {
  kind: 'apikey',
  fields: [
    { key: 'reportUrl', label: 'RaaS report URL (JSON)', placeholder: 'https://…/ccx/service/customreport2/…' },
    { key: 'username', label: 'ISU username', placeholder: 'integration-user@tenant' },
    { key: 'password', label: 'ISU password', type: 'password' },
  ],
  help: 'Use a Workday Report-as-a-Service (RaaS) report that outputs workers with name, email, title and department, plus an Integration System User (ISU).',
  async fetch(creds) {
    const url = creds.reportUrl.includes('format=') ? creds.reportUrl : `${creds.reportUrl}${creds.reportUrl.includes('?') ? '&' : '?'}format=json`;
    const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) throw new Error('Workday rejected the ISU credentials.');
    if (!res.ok) throw new Error(`Workday RaaS ${res.status}`);
    const data = (await res.json().catch(() => null)) as { Report_Entry?: Record<string, unknown>[] } | null;
    const rows = data?.Report_Entry || [];
    const people = rows
      .map((r) =>
        person({
          firstName: pick(r, ['firstName', 'First_Name', 'legalFirstName']),
          lastName: pick(r, ['lastName', 'Last_Name', 'legalLastName']),
          name: pick(r, ['name', 'workerName', 'fullName', 'Worker']),
          email: pick(r, ['email', 'workEmail', 'primaryWorkEmail', 'Email_Address']),
          title: pick(r, ['title', 'jobTitle', 'businessTitle', 'Job_Title']),
          department: pick(r, ['department', 'Department', 'costCenter', 'Supervisory_Organization']),
        })
      )
      .filter((x): x is NormPerson => !!x);
    return { people, label: 'Workday' };
  },
};

/* ------------------------------------------------------------------ */
/* OAuth providers                                                     */
/* ------------------------------------------------------------------ */

interface OAuthProvider {
  kind: 'oauth';
  authProviderName: string;
  configured(): boolean;
  clientId(): string;
  clientSecret(): string;
  redirectUri(): string;
  authorizeUrl(): string;
  tokenUrl(): string;
  scope(): string;
  /** Extra authorize params (Google needs access_type/prompt). */
  authorizeExtra?(): Record<string, string>;
  /** Fetch directory with a valid access token; returns people + a display label. */
  fetch(accessToken: string): Promise<{ people: NormPerson[]; label: string }>;
}

const gusto: OAuthProvider = {
  kind: 'oauth',
  authProviderName: 'Gusto',
  configured: () => GUSTO.configured,
  clientId: () => GUSTO.clientId,
  clientSecret: () => GUSTO.clientSecret,
  redirectUri: () => GUSTO.redirectUri,
  authorizeUrl: () => GUSTO.authorizeUrl || `${GUSTO.apiBase}/oauth/authorize`,
  tokenUrl: () => GUSTO.tokenUrl || `${GUSTO.apiBase}/oauth/token`,
  scope: () => '',
  async fetch(accessToken) {
    const h = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
    const meRes = await fetch(`${GUSTO.apiBase}/v1/me`, { headers: h, cache: 'no-store' });
    if (!meRes.ok) throw new Error(`Gusto /me ${meRes.status}`);
    const me = (await meRes.json().catch(() => null)) as { roles?: { payroll_admin?: { companies?: { uuid?: string; id?: number; name?: string }[] } } } | null;
    const companies = me?.roles?.payroll_admin?.companies || [];
    const company = companies[0];
    const companyId = company?.uuid || company?.id;
    if (!companyId) return { people: [], label: 'Gusto' };
    const empRes = await fetch(`${GUSTO.apiBase}/v1/companies/${companyId}/employees`, { headers: h, cache: 'no-store' });
    if (!empRes.ok) throw new Error(`Gusto employees ${empRes.status}`);
    const emps = (await empRes.json().catch(() => null)) as Record<string, unknown>[] | null;
    const people = (emps ?? [])
      .map((e) =>
        person({
          firstName: pick(e, ['first_name']),
          lastName: pick(e, ['last_name']),
          email: pick(e, ['email', 'work_email']),
          title: (((e.jobs as { title?: string }[]) || [])[0]?.title) || '',
          department: ((((e.jobs as { department?: string }[]) || [])[0]?.department)) || '',
        })
      )
      .filter((x): x is NormPerson => !!x);
    return { people, label: company?.name || 'Gusto' };
  },
};

const google: OAuthProvider = {
  kind: 'oauth',
  authProviderName: 'Google',
  configured: () => GOOGLE_WS.configured,
  clientId: () => GOOGLE_WS.clientId,
  clientSecret: () => GOOGLE_WS.clientSecret,
  redirectUri: () => GOOGLE_WS.redirectUri,
  authorizeUrl: () => GOOGLE_WS.authorizeUrl,
  tokenUrl: () => GOOGLE_WS.tokenUrl,
  scope: () => GOOGLE_WS.scope,
  authorizeExtra: () => ({ access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' }),
  async fetch(accessToken) {
    const res = await fetch(
      'https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=200&orderBy=email',
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, cache: 'no-store' }
    );
    if (res.status === 401 || res.status === 403) throw new Error('Google rejected the request (the account must be a Workspace admin).');
    if (!res.ok) throw new Error(`Google Directory ${res.status}`);
    const data = (await res.json().catch(() => null)) as { users?: Array<{ name?: { givenName?: string; familyName?: string; fullName?: string }; primaryEmail?: string; organizations?: { title?: string; department?: string }[] }> } | null;
    const people = (data?.users ?? [])
      .map((u) =>
        person({
          firstName: u.name?.givenName || '',
          lastName: u.name?.familyName || '',
          name: u.name?.fullName || '',
          email: u.primaryEmail || '',
          title: u.organizations?.[0]?.title || '',
          department: u.organizations?.[0]?.department || '',
        })
      )
      .filter((x): x is NormPerson => !!x);
    return { people, label: 'Google Workspace' };
  },
};

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export const ROSTER_PROVIDERS: Record<string, ApiKeyProvider | OAuthProvider> = {
  rippling,
  okta,
  workday,
  gusto,
  google,
};

export function getRosterProvider(id: string): ApiKeyProvider | OAuthProvider | null {
  return ROSTER_PROVIDERS[id] || null;
}

/* ------------------------------------------------------------------ */
/* Shared operations                                                   */
/* ------------------------------------------------------------------ */

export async function rosterStatus(providerId: string, companyId: string) {
  const provider = getRosterProvider(providerId);
  if (!provider) return { error: 'Unknown provider.' };
  const conn = await getConnection(companyId, providerId as IntegrationProvider);
  return {
    kind: provider.kind,
    connected: conn?.status === 'connected',
    label: conn?.companyName || null,
    serverConfigured: provider.kind === 'oauth' ? provider.configured() : true,
    authProviderName: provider.kind === 'oauth' ? provider.authProviderName : undefined,
    fields: provider.kind === 'apikey' ? provider.fields : undefined,
    help: provider.kind === 'apikey' ? provider.help : undefined,
  };
}

/** API-key connect: validate creds against the live directory, then store. */
export async function rosterConnectApiKey(
  providerId: string,
  companyId: string,
  creds: Record<string, string>
): Promise<{ ok: boolean; error?: string; count?: number; label?: string }> {
  const provider = getRosterProvider(providerId);
  if (!provider || provider.kind !== 'apikey') return { ok: false, error: 'Not an API-key provider.' };
  for (const f of provider.fields) {
    if (!creds[f.key]?.trim()) return { ok: false, error: `${f.label} is required.` };
  }
  try {
    const { people, label } = await provider.fetch(creds);
    const existing = await getConnection(companyId, providerId as IntegrationProvider);
    const conn: IntegrationConnection = {
      companyId,
      provider: providerId as IntegrationProvider,
      accessToken: '',
      refreshToken: '',
      accessExpiresAt: 0,
      companyName: label,
      config: creds,
      status: 'connected',
      connectedAt: existing?.connectedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putConnection(conn);
    return { ok: true, count: people.length, label };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Fetch + normalize the directory for a connected provider. */
export async function rosterDirectory(providerId: string, companyId: string): Promise<NormPerson[]> {
  const provider = getRosterProvider(providerId);
  if (!provider) throw new Error('Unknown provider.');
  const conn = await getConnection(companyId, providerId as IntegrationProvider);
  if (!conn || conn.status !== 'connected') throw new Error(`${providerId} is not connected for this company.`);
  if (provider.kind === 'apikey') {
    return (await provider.fetch(conn.config || {})).people;
  }
  const accessToken = await getValidOAuthToken(providerId, companyId);
  return (await provider.fetch(accessToken)).people;
}

export async function rosterDisconnect(providerId: string, companyId: string): Promise<void> {
  await deleteConnection(companyId, providerId as IntegrationProvider);
}

/* ------------------------------------------------------------------ */
/* OAuth helpers (Gusto, Google)                                       */
/* ------------------------------------------------------------------ */

export function rosterAuthorizeUrl(providerId: string, companyId: string): string | null {
  const provider = getRosterProvider(providerId);
  if (!provider || provider.kind !== 'oauth') return null;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: provider.clientId(),
    redirect_uri: provider.redirectUri(),
    state: signState(companyId, providerId),
    ...(provider.scope() ? { scope: provider.scope() } : {}),
    ...(provider.authorizeExtra?.() || {}),
  });
  return `${provider.authorizeUrl()}?${params.toString()}`;
}

interface TokenResp {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

async function exchangeOAuth(provider: OAuthProvider, body: Record<string, string>): Promise<TokenResp> {
  const res = await fetch(provider.tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: provider.clientId(),
      client_secret: provider.clientSecret(),
      ...body,
    }).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  return JSON.parse(text) as TokenResp;
}

export async function rosterHandleCallback(
  providerId: string,
  code: string,
  state: string
): Promise<{ ok: boolean; companyId?: string; label?: string; error?: string }> {
  const provider = getRosterProvider(providerId);
  if (!provider || provider.kind !== 'oauth') return { ok: false, error: 'Not an OAuth provider.' };
  const companyId = verifyState(state, providerId);
  if (!companyId) return { ok: false, error: 'invalid_state' };
  try {
    const tok = await exchangeOAuth(provider, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: provider.redirectUri(),
    });
    const now = Date.now();
    let label = provider.authProviderName;
    try {
      label = (await provider.fetch(tok.access_token)).label || label;
    } catch {
      /* non-fatal; store anyway */
    }
    const existing = await getConnection(companyId, providerId as IntegrationProvider);
    await putConnection({
      companyId,
      provider: providerId as IntegrationProvider,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token || existing?.refreshToken || '',
      accessExpiresAt: now + (tok.expires_in || 3600) * 1000,
      companyName: label,
      status: 'connected',
      connectedAt: existing?.connectedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { ok: true, companyId, label };
  } catch (err) {
    return { ok: false, companyId, error: (err as Error).message };
  }
}

async function getValidOAuthToken(providerId: string, companyId: string): Promise<string> {
  const provider = getRosterProvider(providerId);
  if (!provider || provider.kind !== 'oauth') throw new Error('Not an OAuth provider.');
  const conn = await getConnection(companyId, providerId as IntegrationProvider);
  if (!conn || conn.status !== 'connected') throw new Error('Not connected.');
  if (Date.now() < conn.accessExpiresAt - REFRESH_SKEW_MS) return conn.accessToken;
  if (!conn.refreshToken) return conn.accessToken; // no refresh available; try as-is
  const tok = await exchangeOAuth(provider, { grant_type: 'refresh_token', refresh_token: conn.refreshToken });
  const updated = await patchConnection(companyId, providerId as IntegrationProvider, {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || conn.refreshToken,
    accessExpiresAt: Date.now() + (tok.expires_in || 3600) * 1000,
  });
  return updated?.accessToken || tok.access_token;
}
