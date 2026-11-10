'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, Input } from '@/components/app/ui';
import { Check, Lock, Users } from '@/components/icons';
import type { Integration } from '@/lib/types';

interface Field {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'password';
}
interface StatusResp {
  kind: 'apikey' | 'oauth';
  connected: boolean;
  label: string | null;
  serverConfigured: boolean;
  authProviderName?: string;
  fields?: Field[];
  help?: string;
}

/**
 * Shared people-sync panel for roster providers (Rippling, Okta, Workday via API
 * key; Gusto, Google via OAuth). Fetches its shape from the provider's status,
 * then imports the live directory into the workspace as people (deduped by email).
 */
export function RosterImportPanel({ integration }: { integration: Integration }) {
  const { state, setIntegrationStatus, inviteUser } = useStore();
  const companyId = state.company.id;
  const params = useSearchParams();
  const api = `/api/integrations/roster/${integration.id}`;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${api}/status?companyId=${encodeURIComponent(companyId)}`);
      const data = (await res.json()) as StatusResp;
      setStatus(data);
      setIntegrationStatus(integration.id, data.connected ? 'connected' : 'available');
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [api, companyId, integration.id, setIntegrationStatus]);

  useEffect(() => {
    const conn = params.get('conn');
    if (conn === 'connected') {
      setBanner({ kind: 'ok', text: `Connected to ${integration.name}${params.get('company') ? ` — ${params.get('company')}` : ''}.` });
    } else if (conn === 'error') {
      setBanner({ kind: 'err', text: `${integration.name} connection failed: ${params.get('reason') || 'unknown error'}.` });
    }
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectApiKey = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`${api}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...creds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Could not connect.' });
        return;
      }
      setCreds({});
      setBanner({ kind: 'ok', text: `Connected — ${data.count} ${data.count === 1 ? 'person' : 'people'} found.` });
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const connectOAuth = () => {
    window.location.href = `${api}/connect?companyId=${encodeURIComponent(companyId)}`;
  };

  const syncRoster = async () => {
    setBusy(true);
    setBanner(null);
    setImportResult(null);
    try {
      const res = await fetch(`${api}/directory?companyId=${encodeURIComponent(companyId)}`);
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Could not read the directory.' });
        return;
      }
      const existing = new Set(state.users.map((u) => u.email.toLowerCase()));
      let added = 0;
      let skipped = 0;
      for (const p of data.people || []) {
        if (existing.has(p.email)) {
          skipped++;
          continue;
        }
        inviteUser({
          name: p.name,
          firstName: p.firstName || undefined,
          lastName: p.lastName || undefined,
          email: p.email,
          department: p.department || 'Unassigned',
          title: p.title || '',
          role: 'employee',
        });
        existing.add(p.email);
        added++;
      }
      setImportResult({ added, skipped });
      setBanner({ kind: 'ok', text: `Imported ${added} new ${added === 1 ? 'person' : 'people'}${skipped ? `, ${skipped} already present` : ''}.` });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch(`${api}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      setImportResult(null);
      await loadStatus();
      setBanner({ kind: 'ok', text: `${integration.name} disconnected.` });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !status) {
    return (
      <Card className="max-w-xl">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Checking {integration.name} connection…
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

      {/* OAuth provider, server not wired */}
      {!status.connected && status.kind === 'oauth' && !status.serverConfigured && (
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {integration.name} connects via {status.authProviderName} OAuth. The app credentials
            aren&apos;t wired on the server yet — once they are, this becomes a live
            &ldquo;Connect&rdquo; flow.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" /> Waiting on the {integration.name} app client id / secret.
          </div>
        </Card>
      )}

      {/* OAuth provider, ready to connect */}
      {!status.connected && status.kind === 'oauth' && status.serverConfigured && (
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Authorize {status.authProviderName} to import your people into HeyVacay. Read-only — we
            only pull names, emails, titles and departments.
          </p>
          <Button className="mt-5" onClick={connectOAuth}>
            Connect {integration.name}
          </Button>
        </Card>
      )}

      {/* API-key provider form */}
      {!status.connected && status.kind === 'apikey' && (
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {status.help || `Enter your ${integration.name} credentials to import your roster.`}
          </p>
          <div className="mt-4 space-y-3">
            {(status.fields || []).map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-semibold text-slate-500">{f.label}</label>
                <Input
                  type={f.type || 'text'}
                  value={creds[f.key] || ''}
                  onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" /> Stored server-side and only used to read your directory.
          </div>
          <Button
            className="mt-5"
            onClick={connectApiKey}
            disabled={busy || (status.fields || []).some((f) => !creds[f.key]?.trim())}
          >
            {busy ? 'Connecting…' : `Connect ${integration.name}`}
          </Button>
        </Card>
      )}

      {/* Connected */}
      {status.connected && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Check className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Connected{status.label ? ` — ${status.label}` : ''}</p>
                  <p className="text-xs text-slate-400">Reading your directory</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy}>
                Disconnect
              </Button>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand-dark">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">Import roster</h2>
                  <p className="text-sm text-slate-400">
                    Pull everyone from {integration.name} into HeyVacay. New people are added as
                    employees; anyone already here (matched by email) is skipped — safe to re-run.
                  </p>
                </div>
              </div>
              <Button onClick={syncRoster} disabled={busy}>
                {busy ? 'Syncing…' : 'Sync roster'}
              </Button>
            </div>
            {importResult && (
              <div className="mt-4 flex gap-3 text-sm">
                <Badge color="green">{importResult.added} added</Badge>
                <Badge color="slate">{importResult.skipped} already present</Badge>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-400">{state.users.length} people currently in your workspace.</p>
          </Card>
        </>
      )}
    </div>
  );
}
