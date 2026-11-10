'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, Input } from '@/components/app/ui';
import { Check, Lock, Users } from '@/components/icons';
import type { Integration } from '@/lib/types';

interface DirPerson {
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  title: string;
  department: string;
}

/**
 * BambooHR — real per-company roster sync. The admin pastes their BambooHR
 * subdomain + API key (each BambooHR account issues its own), we validate against
 * the live directory, then import employees as HeyVacay people (deduped by email).
 */
export function BambooHRPanel({ integration }: { integration: Integration }) {
  const { state, setIntegrationStatus, inviteUser } = useStore();
  const companyId = state.company.id;

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connectedSub, setConnectedSub] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/bamboohr/status?companyId=${encodeURIComponent(companyId)}`);
      const data = await res.json();
      setConnected(Boolean(data.connected));
      setConnectedSub(data.subdomain || null);
      setIntegrationStatus('bamboohr', data.connected ? 'connected' : 'available');
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
      const res = await fetch('/api/integrations/bamboohr/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, subdomain, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Could not connect to BambooHR.' });
        return;
      }
      setApiKey('');
      setBanner({ kind: 'ok', text: `Connected to BambooHR (${data.subdomain}) — ${data.count} employees found.` });
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const syncRoster = async () => {
    setBusy(true);
    setBanner(null);
    setImportResult(null);
    try {
      const res = await fetch(`/api/integrations/bamboohr/directory?companyId=${encodeURIComponent(companyId)}`);
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Could not read the BambooHR directory.' });
        return;
      }
      const people: DirPerson[] = data.people || [];
      const existing = new Set(state.users.map((u) => u.email.toLowerCase()));
      let added = 0;
      let skipped = 0;
      for (const p of people) {
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
      setBanner({
        kind: 'ok',
        text: `Imported ${added} new ${added === 1 ? 'person' : 'people'}${skipped ? `, ${skipped} already in your workspace` : ''}.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch('/api/integrations/bamboohr/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      setImportResult(null);
      await loadStatus();
      setBanner({ kind: 'ok', text: 'BambooHR disconnected.' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="max-w-xl">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Checking BambooHR connection…
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
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Paste your BambooHR subdomain and an API key — we&apos;ll read your employee directory so
            you can import your roster. Each BambooHR account issues its own key.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Subdomain</label>
              <div className="flex items-center gap-2">
                <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="yourcompany" />
                <span className="text-sm text-slate-400">.bamboohr.com</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">API key</label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Your BambooHR API key" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            Your key is stored server-side and only used to read your directory. Generate it in
            BambooHR under your profile → API Keys.
          </div>
          <Button className="mt-5" onClick={connect} disabled={busy || !subdomain.trim() || !apiKey.trim()}>
            {busy ? 'Connecting…' : 'Connect BambooHR'}
          </Button>
        </Card>
      )}

      {connected && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Check className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Connected{connectedSub ? ` — ${connectedSub}.bamboohr.com` : ''}</p>
                  <p className="text-xs text-slate-400">Reading your employee directory</p>
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
                    Pull everyone from BambooHR into HeyVacay. New people are added as employees;
                    anyone already here (matched by email) is skipped — safe to run again anytime.
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
