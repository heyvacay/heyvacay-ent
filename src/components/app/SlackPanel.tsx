'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Button, Card, Input } from '@/components/app/ui';
import { Check, Lock } from '@/components/icons';
import { SetupGuide } from '@/components/app/SetupGuide';
import type { Integration } from '@/lib/types';

/**
 * Slack — real per-company Incoming Webhook. The admin pastes a webhook URL from
 * their Slack app; HeyVacay posts approval requests and trip alerts to that
 * channel. URLs are restricted server-side to Slack's host.
 */
export function SlackPanel({ integration }: { integration: Integration }) {
  const { state, setIntegrationStatus } = useStore();
  const companyId = state.company.id;

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/slack/status?companyId=${encodeURIComponent(companyId)}`);
      const data = await res.json();
      setConnected(Boolean(data.connected));
      setHint(data.webhookHint || null);
      setTeam(data.team || null);
      setOauthConfigured(Boolean(data.oauthConfigured));
      setIntegrationStatus('slack', data.connected ? 'connected' : 'available');
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [companyId, setIntegrationStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Returning from the "Add to Slack" OAuth round-trip (?conn=connected|error).
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const conn = p.get('conn');
      if (!conn) return;
      if (conn === 'connected') {
        const t = p.get('team');
        setBanner({ kind: 'ok', text: t ? `Connected to ${t} — a hello message was sent to your channel.` : 'Slack connected — a hello message was sent to your channel.' });
      } else if (conn === 'error') {
        setBanner({ kind: 'err', text: `Couldn't connect Slack${p.get('reason') ? ` (${p.get('reason')})` : ''}. Please try again.` });
      }
      // Clean the query so a refresh doesn't re-show the banner.
      const url = new URL(window.location.href);
      ['conn', 'team', 'reason'].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, '', url.toString());
      void loadStatus();
    } catch {
      /* ignore */
    }
  }, [loadStatus]);

  const connect = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/integrations/slack/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, webhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Could not connect Slack.' });
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
      const res = await fetch('/api/integrations/slack/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      setBanner(res.ok ? { kind: 'ok', text: 'Test message sent to Slack.' } : { kind: 'err', text: data?.error || 'Could not send.' });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/integrations/slack/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      await loadStatus();
      setBanner({ kind: 'ok', text: 'Slack disconnected.' });
    } finally {
      setBusy(false);
    }
  };

  const SlackGlyph = () => (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
      <path fill="#36C5F0" d="M18 6a4 4 0 100 8h4V10a4 4 0 00-4-4z" />
      <path fill="#2EB67D" d="M42 18a4 4 0 10-8 0v4h4a4 4 0 004-4z" />
      <path fill="#ECB22E" d="M30 42a4 4 0 108 0v-4h-4a4 4 0 00-4 4z" />
      <path fill="#E01E5A" d="M6 30a4 4 0 108 0v-4h-4a4 4 0 00-4 4z" />
      <rect x="20" y="14" width="8" height="4" rx="2" fill="#2EB67D" />
      <rect x="30" y="20" width="4" height="8" rx="2" fill="#ECB22E" />
      <rect x="20" y="30" width="8" height="4" rx="2" fill="#E01E5A" />
      <rect x="14" y="20" width="4" height="8" rx="2" fill="#36C5F0" />
      <rect x="20" y="20" width="8" height="8" rx="2" fill="#fff" />
    </svg>
  );

  if (loading) {
    return (
      <Card className="max-w-xl">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Checking Slack connection…
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
          {/* One-click OAuth path (when the platform Slack app is configured) */}
          {oauthConfigured && (
            <Card>
              <h2 className="font-display text-lg font-bold text-slate-900">Add HeyVacay to Slack</h2>
              <p className="mt-1 text-sm text-slate-500">
                One click — authorize HeyVacay, pick the channel for approval requests and trip
                alerts, and you&apos;re done. No app to build, nothing to copy or paste.
              </p>
              <a
                href={`/api/integrations/slack/connect?companyId=${encodeURIComponent(companyId)}`}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#4A154B] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                <SlackGlyph /> Add to Slack
              </a>
              <button
                type="button"
                onClick={() => setShowManual((v) => !v)}
                className="mt-4 block text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                {showManual ? 'Hide manual setup' : 'Prefer to set it up manually with a webhook URL?'}
              </button>
            </Card>
          )}

          {/* Manual webhook path — the only option when OAuth isn't configured,
              otherwise a collapsible fallback. */}
          {(!oauthConfigured || showManual) && (
            <>
              <SetupGuide id={integration.id} name={integration.name} />
              <Card>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {oauthConfigured ? 'Connect manually with a webhook URL' : `Connect ${integration.name}`}
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
                    placeholder="https://hooks.slack.com/services/T000/B000/XXXX"
                  />
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                  Stored server-side and only used to post to your channel. Must be a hooks.slack.com URL.
                </div>
                <Button className="mt-5" onClick={connect} disabled={busy || !webhookUrl.trim()}>
                  {busy ? 'Connecting…' : 'Connect Slack'}
                </Button>
              </Card>
            </>
          )}
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
                <p className="font-semibold text-slate-800">Connected{team ? ` to ${team}` : ''}</p>
                <p className="text-xs text-slate-400">Webhook {hint || 'configured'} · approvals & trip alerts post here</p>
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
