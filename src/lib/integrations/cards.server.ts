import 'server-only';

/**
 * Corporate-card providers (Ramp, Brex) — pull recent card transactions so they
 * can be reconciled against trips/bookings. Per-company credentials (no shared
 * app): Ramp uses a client id + secret (client-credentials grant), Brex a
 * per-company API token. Both stored in the per-company connection.
 */

import {
  getConnection,
  putConnection,
  deleteConnection,
  type IntegrationConnection,
  type IntegrationProvider,
} from './tokenStore.server';
import type { ApiKeyField } from './roster.server';

export interface CardTxn {
  id: string;
  date: string; // ISO
  merchant: string;
  amount: number; // positive dollars
  cardHolder?: string;
  last4?: string;
  status?: string;
}

interface CardProvider {
  fields: ApiKeyField[];
  help?: string;
  /** Validate creds + fetch recent transactions. Throws on bad creds. */
  fetch(creds: Record<string, string>): Promise<{ txns: CardTxn[]; label: string }>;
}

const ramp: CardProvider = {
  fields: [
    { key: 'clientId', label: 'Client ID', placeholder: 'Ramp API client id' },
    { key: 'clientSecret', label: 'Client secret', type: 'password', placeholder: 'Ramp API client secret' },
  ],
  help: 'Create API credentials in Ramp → Settings → Developer API (grant the transactions:read scope).',
  async fetch(creds) {
    const base = 'https://api.ramp.com/developer/v1';
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    const tokRes = await fetch(`${base}/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'transactions:read' }).toString(),
    });
    if (tokRes.status === 401 || tokRes.status === 403) throw new Error('Ramp rejected the client credentials.');
    if (!tokRes.ok) throw new Error(`Ramp token ${tokRes.status}`);
    const tok = (await tokRes.json().catch(() => null)) as { access_token?: string } | null;
    if (!tok?.access_token) throw new Error('Ramp did not return a token.');
    const txRes = await fetch(`${base}/transactions?page_size=50`, {
      headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!txRes.ok) throw new Error(`Ramp transactions ${txRes.status}`);
    const data = (await txRes.json().catch(() => null)) as { data?: Record<string, unknown>[] } | null;
    const txns = (data?.data ?? []).map((t): CardTxn => {
      const ch = t.card_holder as { first_name?: string; last_name?: string } | undefined;
      return {
        id: String(t.id ?? ''),
        date: String(t.user_transaction_time ?? t.created_at ?? ''),
        merchant: String(t.merchant_name ?? 'Card transaction'),
        amount: Number(t.amount ?? 0),
        cardHolder: ch ? `${ch.first_name || ''} ${ch.last_name || ''}`.trim() : undefined,
        status: String(t.state ?? ''),
      };
    });
    return { txns, label: 'Ramp' };
  },
};

const brex: CardProvider = {
  fields: [{ key: 'apiToken', label: 'API token', type: 'password', placeholder: 'Brex API token' }],
  help: 'Create a token in Brex → Developer → Tokens with the transactions scope.',
  async fetch(creds) {
    const res = await fetch('https://platform.brexapis.com/v2/transactions/card/primary?limit=50', {
      headers: { Authorization: `Bearer ${creds.apiToken}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) throw new Error('Brex rejected the API token.');
    if (!res.ok) throw new Error(`Brex transactions ${res.status}`);
    const data = (await res.json().catch(() => null)) as { items?: Record<string, unknown>[] } | null;
    const txns = (data?.items ?? []).map((t): CardTxn => {
      const amt = t.amount as { amount?: number } | undefined;
      return {
        id: String(t.id ?? ''),
        date: String(t.posted_at_date ?? t.initiated_at_date ?? ''),
        merchant: String(t.description ?? 'Card transaction'),
        // Brex amounts are in cents.
        amount: Math.abs(Number(amt?.amount ?? 0)) / 100,
        status: String(t.type ?? ''),
      };
    });
    return { txns, label: 'Brex' };
  },
};

export const CARD_PROVIDERS: Record<string, CardProvider> = { ramp, brex };

export function getCardProvider(id: string): CardProvider | null {
  return CARD_PROVIDERS[id] || null;
}

export async function cardStatus(providerId: string, companyId: string) {
  const provider = getCardProvider(providerId);
  if (!provider) return { error: 'Unknown provider.' };
  const conn = await getConnection(companyId, providerId as IntegrationProvider);
  return {
    connected: conn?.status === 'connected',
    label: conn?.companyName || null,
    fields: provider.fields,
    help: provider.help,
  };
}

export async function cardConnect(
  providerId: string,
  companyId: string,
  creds: Record<string, string>
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const provider = getCardProvider(providerId);
  if (!provider) return { ok: false, error: 'Unknown provider.' };
  for (const f of provider.fields) if (!creds[f.key]?.trim()) return { ok: false, error: `${f.label} is required.` };
  try {
    const { txns, label } = await provider.fetch(creds);
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
    return { ok: true, count: txns.length };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function cardTransactions(providerId: string, companyId: string): Promise<CardTxn[]> {
  const provider = getCardProvider(providerId);
  if (!provider) throw new Error('Unknown provider.');
  const conn = await getConnection(companyId, providerId as IntegrationProvider);
  if (!conn || conn.status !== 'connected') throw new Error(`${providerId} is not connected for this company.`);
  return (await provider.fetch(conn.config || {})).txns;
}

export async function cardDisconnect(providerId: string, companyId: string): Promise<void> {
  await deleteConnection(companyId, providerId as IntegrationProvider);
}
