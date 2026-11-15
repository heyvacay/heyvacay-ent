'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Button, Card, Input } from '@/components/app/ui';
import { Check, Lock } from '@/components/icons';
import { SetupGuide } from '@/components/app/SetupGuide';
import type { Integration } from '@/lib/types';

/**
 * Microsoft Teams — real per-company Incoming Webhook. The admin creates a Teams
 * webhook (Workflows / Power Automate, or the legacy connector) and pastes the
 * URL; HeyVacay posts approval requests and trip alerts to that channel. URLs
 * are restricted server-side to Microsoft's webhook hosts.
 */
export function TeamsPanel({ integration }: { integration: Integration }) {
  const { state, setIntegrationStatus } = useStore();
  const companyId = state.company.id;

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/teams/status?companyId=${encodeURIComponent(companyId)}`);
      const data = await res.json();
      setConnected(Boolean(data.connected));
      setHint(data.webhookHint || null);
      setIntegrationStatus('teams', data.connected ? 'connected' : 'available');
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [companyId, setIntegrationStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const connect = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/integrations/teams/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Could not connect Microsoft Teams.' });
        return;
      }
      setWebhookUrl('');
      setBanner({ kind: 'ok', text: 'Connected — a hello message was sent to your channel.' });
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/integrations/teams/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      setBanner(res.ok ? { kind: 'ok', text: 'Test message sent to Teams.' } : { kind: 'err', text: data?.error || 'Could not send.' });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/integrations/teams/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      await loadStatus();
      setBanner({ kind: 'ok', text: 'Microsoft Teams disconnected.' });
    } finally {
      setBusy(false);
    }
  };

  const TeamsGlyph = () => (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <circle cx="34" cy="12" r="5" fill="#fff" opacity="0.9" />
      <rect x="6" y="16" width="26" height="22" rx="4" fill="#fff" />
      <text x="19" y="33" textAnchor="middle" fontSize="16" fontWeight="700" fill="#5059C9" fontFamily="Arial">T</text>
    </svg>
  );

  if (loading) {
    return (
      <Card className="max-w-xl">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Checking Microsoft Teams connection…
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={
            banner.kind === 'ok'
              ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
              : 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'
          }
        >
          {banner.text}
        </div>
      )}

      {!connected && (
        <div className="max-w-xl space-y-5">
          <SetupGuide id={integration.id} name={integration.name} />
          <Card>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-[#5059C9]">
                <TeamsGlyph />
              </span>
              Connect {integration.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Paste the <strong>Incoming Webhook URL</strong> from the steps above and we&apos;ll post
              approval requests and trip alerts to that channel.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Webhook URL</label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://…webhook.office.com/… or a Workflows …logic.azure.com URL"
              />
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <Lock className="h-4 w-4 shrink-0 text-slate-400" />
              Stored server-side and only used to post to your channel. Must be a Microsoft Teams
              webhook (webhook.office.com or a Workflows logic.azure.com URL).
            </div>
            <Button className="mt-5" onClick={connect} disabled={busy || !webhookUrl.trim()}>
              {busy ? 'Connecting…' : 'Connect Microsoft Teams'}
            </Button>
          </Card>
        </div>
      )}

      {connected && (
        <Card className="max-w-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                <Check className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-slate-800">Connected</p>
                <p className="text-xs text-slate-400">Webhook {hint || 'configured'} · approvals &amp; trip alerts post here</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy}>
              Disconnect
            </Button>
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={sendTest} disabled={busy}>
              {busy ? 'Sending…' : 'Send test message'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
