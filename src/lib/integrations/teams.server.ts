import 'server-only';

/**
 * Microsoft Teams integration — per-company Incoming Webhook.
 *
 * The admin creates a webhook that posts into one Teams channel and pastes the
 * URL here; HeyVacay posts approval requests and trip alerts to that channel.
 * Both the modern path (Teams "Workflows" / Power Automate, on *.logic.azure.com
 * or *.powerplatform.com) and the legacy Office 365 connector (*.webhook.office.com)
 * are supported.
 *
 * URLs are restricted server-side to Microsoft's webhook hosts (no arbitrary
 * URLs, so this can't be used for SSRF), mirroring the Slack integration.
 */

import {
  getConnection,
  putConnection,
  deleteConnection,
  type IntegrationConnection,
} from './tokenStore.server';

const PROVIDER = 'teams' as const;

// Allowed webhook hosts (suffix match). Covers Workflows/Power Automate and the
// legacy Office 365 connector.
const TEAMS_HOST_SUFFIXES = ['.webhook.office.com', '.logic.azure.com', '.powerplatform.com'];

export function isValidWebhook(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return TEAMS_HOST_SUFFIXES.some((s) => u.hostname.toLowerCase().endsWith(s));
  } catch {
    return false;
  }
}

/**
 * Post a message to a Teams webhook. We send BOTH a top-level `text` (which the
 * legacy connector and simple Workflow templates read) and an Adaptive Card
 * attachment (what the common "post a card" Workflow expects), so one payload
 * works across the Teams webhook flavors. A 2xx is treated as success — Teams
 * returns "1" for the legacy connector and 200/202 for Workflows.
 */
export async function sendToWebhook(url: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidWebhook(url)) return { ok: false, error: 'Not a valid Microsoft Teams webhook URL.' };
  const payload = {
    type: 'message',
    text,
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [{ type: 'TextBlock', text, wrap: true }],
        },
      },
    ],
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: body ? body.slice(0, 160) : `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Validate + store a company's Teams webhook (sends a hello message to confirm). */
export async function connect(companyId: string, webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidWebhook(webhookUrl)) {
    return {
      ok: false,
      error: 'That doesn’t look like a Microsoft Teams webhook URL (…webhook.office.com or a Workflows …logic.azure.com URL).',
    };
  }
  const hello = await sendToWebhook(
    webhookUrl,
    '👋 HeyVacay is now connected to this channel — you’ll get approval requests and trip alerts here.',
  );
  if (!hello.ok) return { ok: false, error: `Teams rejected the webhook: ${hello.error}` };
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

/** Send a message to a company's connected Teams (no-op if not connected). */
export async function notify(companyId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const url = await getWebhook(companyId);
  if (!url) return { ok: false, error: 'Microsoft Teams is not connected for this company.' };
  return sendToWebhook(url, text);
}

export async function disconnect(companyId: string): Promise<void> {
  await deleteConnection(companyId, PROVIDER);
}
