'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Button, Card, Input } from '@/components/app/ui';
import { Check, Lock } from '@/components/icons';
import { SetupGuide } from '@/components/app/SetupGuide';
import { money2, shortDate } from '@/lib/format';
import type { Integration } from '@/lib/types';

interface Field { key: string; label: string; placeholder?: string; type?: 'text' | 'password' }
interface StatusResp { connected: boolean; label: string | null; fields: Field[]; help?: string }
interface Txn { id: string; date: string; merchant: string; amount: number; cardHolder?: string; status?: string }

/**
 * Corporate-card feed (Ramp, Brex): connect per-company credentials, then pull
 * recent card transactions to reconcile against trips. Read-only feed.
 */
export function CardFeedPanel({ integration }: { integration: Integration }) {
  const { state, setIntegrationStatus } = useStore();
  const companyId = state.company.id;
  const api = `/api/integrations/cards/${integration.id}`;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
    void loadStatus();
  }, [loadStatus]);

  const connect = async () => {
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
      setBanner({ kind: 'ok', text: `Connected — ${data.count} recent transactions found.` });
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const load = async () => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`${api}/transactions?companyId=${encodeURIComponent(companyId)}`);
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Could not load transactions.' });
        return;
      }
      setTxns(data.txns || []);
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
      setTxns(null);
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
        <div className={banner.kind === 'ok' ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800' : 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'}>
          {banner.text}
        </div>
      )}

      {!status.connected && (
        <div className="max-w-xl space-y-5">
        <SetupGuide id={integration.id} name={integration.name} />
        <Card>
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {status.help || `Enter your ${integration.name} API credentials to pull recent card transactions.`}
          </p>
          <div className="mt-4 space-y-3">
            {status.fields.map((f) => (
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
            <Lock className="h-4 w-4 shrink-0 text-slate-400" /> Stored server-side; read-only access to transactions.
          </div>
          <Button className="mt-5" onClick={connect} disabled={busy || status.fields.some((f) => !creds[f.key]?.trim())}>
            {busy ? 'Connecting…' : `Connect ${integration.name}`}
          </Button>
        </Card>
        </div>
      )}

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
                  <p className="text-xs text-slate-400">Reconcile card spend against trips</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy}>
                Disconnect
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Recent card transactions</h2>
                <p className="text-sm text-slate-400">The latest card swipes from {integration.name}.</p>
              </div>
              <Button onClick={load} disabled={busy}>
                {busy ? 'Loading…' : 'Load transactions'}
              </Button>
            </div>
            {txns && txns.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 font-semibold">Date</th>
                      <th className="px-4 py-2.5 font-semibold">Merchant</th>
                      <th className="px-4 py-2.5 font-semibold">Cardholder</th>
                      <th className="px-4 py-2.5 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t) => (
                      <tr key={t.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{t.date ? shortDate(t.date.slice(0, 10)) : '—'}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{t.merchant}</td>
                        <td className="px-4 py-2.5 text-slate-500">{t.cardHolder || '—'}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">{money2(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {txns && txns.length === 0 && <p className="text-sm text-slate-400">No recent transactions.</p>}
          </Card>
        </>
      )}
    </div>
  );
}
