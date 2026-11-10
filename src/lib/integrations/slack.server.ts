import 'server-only';

/**
 * Slack integration — per-company Incoming Webhook. The admin pastes a webhook
 * URL from their Slack app; HeyVacay posts approval requests and trip alerts to
 * that channel. Webhook URLs are restricted to Slack's host (no arbitrary URLs,
 * so this can't be used for SSRF).
 */

import {
  getConnection,
  putConnection,
  deleteConnection,
  type IntegrationConnection,
} from './tokenStore.server';

const PROVIDER = 'slack' as const;
const SLACK_HOST = 'hooks.slack.com';

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
