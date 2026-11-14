import 'server-only';

/**
 * Slack integration — per-company Incoming Webhook. The admin pastes a webhook
 * URL from their Slack app; HeyVacay posts approval requests and trip alerts to
 * that channel. Webhook URLs are restricted to Slack's host (no arbitrary URLs,
 * so this can't be used for SSRF).
 */

import { SLACK } from '@/lib/config.server';
import { signState, verifyState } from './oauthState.server';
import {
  getConnection,
  putConnection,
  deleteConnection,
  type IntegrationConnection,
} from './tokenStore.server';

const PROVIDER = 'slack' as const;
const SLACK_HOST = 'hooks.slack.com';

/* ---------- OAuth ("Add to Slack") — one shared HeyVacay app ---------- */

/** Whether the platform Slack app is configured (enables one-click install). */
export function slackOAuthConfigured(): boolean {
  return SLACK.configured;
}

/** Build the Slack consent URL for a company (incoming-webhook scope). */
export function slackAuthorizeUrl(companyId: string, redirectUri: string): string | null {
  if (!SLACK.configured) return null;
  const u = new URL('https://slack.com/oauth/v2/authorize');
  u.searchParams.set('client_id', SLACK.clientId);
  u.searchParams.set('scope', 'incoming-webhook');
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', signState(companyId, PROVIDER));
  return u.toString();
}

interface SlackOAuthResponse {
  ok?: boolean;
  error?: string;
  access_token?: string;
  team?: { id?: string; name?: string };
  incoming_webhook?: { url?: string; channel?: string; channel_id?: string; configuration_url?: string };
}

/**
 * Exchange the OAuth code for an incoming webhook and store it for the company.
 * The one-click path: Slack returns the webhook URL for the channel the admin
 * picked during consent, so there's nothing for them to copy or paste.
 */
export async function connectViaOAuth(
  code: string,
  state: string,
  redirectUri: string
): Promise<{ ok: boolean; companyId?: string; label?: string; error?: string }> {
  const companyId = verifyState(state, PROVIDER);
  if (!companyId) return { ok: false, error: 'invalid_state' };
  if (!SLACK.configured) return { ok: false, companyId, error: 'not_configured' };
  const form = new URLSearchParams({
    client_id: SLACK.clientId,
    client_secret: SLACK.clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => null)) as SlackOAuthResponse | null;
  if (!data?.ok) return { ok: false, companyId, error: data?.error || `HTTP ${res.status}` };
  const url = data.incoming_webhook?.url;
  if (!url || !isValidWebhook(url)) return { ok: false, companyId, error: 'no_webhook' };
  const team = data.team?.name;
  const channel = data.incoming_webhook?.channel;
  const existing = await getConnection(companyId, PROVIDER);
  const conn: IntegrationConnection = {
    companyId,
    provider: PROVIDER,
    accessToken: data.access_token || '',
    refreshToken: '',
    accessExpiresAt: 0,
    config: { webhookUrl: url, channel: channel || '', team: team || '' },
    companyName: team || channel || undefined,
    status: 'connected',
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putConnection(conn);
  await sendToWebhook(
    url,
    ':wave: HeyVacay is now connected to this channel — approval requests and trip alerts will post here.'
  );
  return { ok: true, companyId, label: team || channel };
}

export function isValidWebhook(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === SLACK_HOST && u.pathname.startsWith('/services/');
  } catch {
    return false;
  }
}

/** Post a message to a Slack incoming webhook. Returns ok + any error text. */
export async function sendToWebhook(url: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidWebhook(url)) return { ok: false, error: 'Not a valid Slack webhook URL.' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const body = await res.text().catch(() => '');
    if (!res.ok || body.trim().toLowerCase() !== 'ok') {
      return { ok: false, error: body ? body.slice(0, 160) : `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Validate + store a company's Slack webhook (sends a hello message to confirm). */
export async function connect(companyId: string, webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidWebhook(webhookUrl)) return { ok: false, error: 'That doesn’t look like a Slack webhook URL (https://hooks.slack.com/services/…).' };
  const hello = await sendToWebhook(webhookUrl, ':wave: HeyVacay is now connected to this channel — you’ll get approval requests and trip alerts here.');
  if (!hello.ok) return { ok: false, error: `Slack rejected the webhook: ${hello.error}` };
  const existing = await getConnection(companyId, PROVIDER);
  const conn: IntegrationConnection = {
    companyId,
    provider: PROVIDER,
    accessToken: '',
    refreshToken: '',
    accessExpiresAt: 0,
    config: { webhookUrl },
    status: 'connected',
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putConnection(conn);
  return { ok: true };
}

export async function getWebhook(companyId: string): Promise<string | null> {
  const conn = await getConnection(companyId, PROVIDER);
  return conn?.status === 'connected' ? conn.config?.webhookUrl || null : null;
}

/** Send a message to a company's connected Slack (no-op if not connected). */
export async function notify(companyId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const url = await getWebhook(companyId);
  if (!url) return { ok: false, error: 'Slack is not connected for this company.' };
  return sendToWebhook(url, text);
}

export async function disconnect(companyId: string): Promise<void> {
  await deleteConnection(companyId, PROVIDER);
}
