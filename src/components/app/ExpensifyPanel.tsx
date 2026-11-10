'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, Input } from '@/components/app/ui';
import { Check, Lock } from '@/components/icons';
import type { Integration } from '@/lib/types';

interface Field { key: string; label: string; placeholder?: string; type?: 'text' | 'password' }
interface StatusResp { connected: boolean; label: string | null; fields: Field[] }
interface Policy { id: string; name: string; role?: string; type?: string }

/**
 * Expensify — per-company Integration Server credentials. Validates by listing
 * the account's policies (workspaces) and shows them so the admin can confirm
 * the link. Full report import is the next step; this establishes the connection.
 */
export function ExpensifyPanel({ integration }: { integration: Integration }) {
  const { state, setIntegrationStatus } = useStore();
  const companyId = state.company.id;
  const api = '/api/integrations/expensify';

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${api}/status?companyId=${encodeURIComponent(companyId)}`);
      const data = (await res.json()) as StatusResp;
      setStatus(data);
      setIntegrationStatus('expensify', data.connected ? 'connected' : 'available');
    } catch {
      setStatus(null);
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
      const res = await fetch(`${api}/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId, ...creds }) });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Could not connect.' });
        return;
      }
      setCreds({});
      setBanner({ kind: 'ok', text: `Connected — ${data.count} ${data.count === 1 ? 'policy' : 'policies'} found.` });
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const loadPolicies = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${api}/policies?companyId=${encodeURIComponent(companyId)}`);
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Could not load policies.' });
        return;
      }
      setPolicies(data.policies || []);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch(`${api}/disconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId }) });
      setPolicies(null);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  if (loading || !status) {
    return (
      <Card className="max-w-xl">
        <div className="flex items-center gap-2 text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" /> Checking Expensify connection…</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {banner && (
        <div className={banner.kind === 'ok' ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800' : 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'}>{banner.text}</div>
      )}

      {!status.connected && (
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create Integration Server credentials at expensify.com → Settings → Account → API, then
            paste the partner User ID + secret.
          </p>
          <div className="mt-4 space-y-3">
            {status.fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-semibold text-slate-500">{f.label}</label>
                <Input type={f.type || 'text'} value={creds[f.key] || ''} onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))} placeholder={f.placeholder} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" /> Stored server-side; used to read your policies.
          </div>
          <Button className="mt-5" onClick={connect} disabled={busy || status.fields.some((f) => !creds[f.key]?.trim())}>
            {busy ? 'Connecting…' : 'Connect Expensify'}
          </Button>
        </Card>
      )}

      {status.connected && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><Check className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold text-slate-800">Connected{status.label ? ` — ${status.label}` : ''}</p>
                  <p className="text-xs text-slate-400">Expensify Integration Server linked</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy}>Disconnect</Button>
            </div>
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Workspaces (policies)</h2>
                <p className="text-sm text-slate-400">Confirm the right Expensify workspaces are linked.</p>
              </div>
              <Button onClick={loadPolicies} disabled={busy}>{busy ? 'Loading…' : 'Load policies'}</Button>
            </div>
            {policies && (
              <div className="flex flex-wrap gap-2">
                {policies.map((p) => (
                  <Badge key={p.id} color="slate">{p.name}{p.role ? ` · ${p.role}` : ''}</Badge>
                ))}
                {policies.length === 0 && <p className="text-sm text-slate-400">No policies found.</p>}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
