'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, Input, Select } from '@/components/app/ui';
import { Check, Lock } from '@/components/icons';
import { money2 } from '@/lib/format';
import { recommendMappings } from '@/lib/integrations/quickbooksMapping';
import type { ExpenseCategory, Integration } from '@/lib/types';

const CATEGORIES: ExpenseCategory[] = ['Meals', 'Ground transport', 'Lodging', 'Airfare', 'Supplies', 'Other'];

interface Field { key: string; label: string; placeholder?: string; type?: 'text' | 'password' }
interface AcctOpt { id: string; name: string; type: string }
interface StatusResp {
  connected: boolean;
  label: string | null;
  accountMap: Record<string, string>;
  paymentAccountId: string | null;
  fields: Field[];
}
interface ResultRow { id: string; ok: boolean; extId?: string; error?: string; verified?: boolean }

/**
 * NetSuite — per-company Token-Based Auth connect, live chart of accounts
 * (SuiteQL), category mapping with smart suggestions, and posting approved
 * expenses as Journal Entries.
 */
export function NetSuitePanel({ integration }: { integration: Integration }) {
  const { state, setIntegrationStatus, syncExpense } = useStore();
  const companyId = state.company.id;
  const api = '/api/integrations/netsuite';

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<{ expense: AcctOpt[]; payment: AcctOpt[] } | null>(null);
  const [accountsErr, setAccountsErr] = useState<string | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [suggestedFor, setSuggestedFor] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [mapSaved, setMapSaved] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const postable = useMemo(
    () => state.expenses.filter((e) => (e.status === 'approved' || e.status === 'reimbursed') && !e.synced),
    [state.expenses]
  );

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${api}/status?companyId=${encodeURIComponent(companyId)}`);
      const data = (await res.json()) as StatusResp;
      setStatus(data);
      setMap(data.accountMap || {});
      setPaymentAccountId(data.paymentAccountId || '');
      setIntegrationStatus('netsuite', data.connected ? 'connected' : 'available');
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, setIntegrationStatus]);

  const loadAccounts = useCallback(async () => {
    setAccountsErr(null);
    try {
      const res = await fetch(`${api}/accounts?companyId=${encodeURIComponent(companyId)}`);
      const data = await res.json();
      if (!res.ok) {
        setAccountsErr(data?.error || 'Could not load the chart of accounts.');
        return;
      }
      setAccounts({ expense: data.expense || [], payment: data.payment || [] });
    } catch (err) {
      setAccountsErr((err as Error).message);
    }
  }, [companyId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);
  useEffect(() => {
    if (status?.connected) void loadAccounts();
  }, [status?.connected, loadAccounts]);

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
        setBanner({ kind: 'err', text: data?.error || 'Could not connect to NetSuite.' });
        return;
      }
      setCreds({});
      setBanner({ kind: 'ok', text: 'Connected to NetSuite.' });
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const applySuggestions = () => {
    if (!accounts) return;
    const rec = recommendMappings(accounts.expense, accounts.payment);
    const next = { ...map };
    const ns: Record<string, string> = {};
    for (const c of CATEGORIES) if (!next[c] && rec.accountMap[c]) { next[c] = rec.accountMap[c]; ns[c] = rec.reasons[c] || 'Recommended'; }
    setMap(next);
    setSuggestedFor((p) => ({ ...p, ...ns }));
    if (!paymentAccountId && rec.paymentAccountId) setPaymentAccountId(rec.paymentAccountId);
    setBanner({ kind: 'ok', text: 'Suggestions filled in — review each row before saving.' });
  };

  const saveMapping = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${api}/mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, accountMap: map, paymentAccountId }),
      });
      if (res.ok) {
        setMapSaved(true);
        setTimeout(() => setMapSaved(false), 2500);
      } else {
        const d = await res.json().catch(() => null);
        setBanner({ kind: 'err', text: d?.error || 'Could not save.' });
      }
    } finally {
      setBusy(false);
    }
  };

  const runSync = async () => {
    setBusy(true);
    setResults(null);
    try {
      const res = await fetch(`${api}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          expenses: postable.map((e) => ({ id: e.id, merchant: e.merchant, category: e.category, amount: e.amount, date: e.date, note: e.note })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Sync failed.' });
        return;
      }
      setResults(data.results || []);
      for (const r of (data.results || []) as ResultRow[]) if (r.ok) syncExpense(r.id);
      setBanner({ kind: data.failed ? 'err' : 'ok', text: `Posted ${data.posted} to NetSuite${data.failed ? `, ${data.failed} failed` : ''}.` });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch(`${api}/disconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId }) });
      setAccounts(null);
      setResults(null);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const mappedCount = CATEGORIES.filter((c) => map[c]).length;

  if (loading || !status) {
    return (
      <Card className="max-w-xl">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" /> Checking NetSuite connection…
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
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            NetSuite uses Token-Based Auth. In NetSuite, enable TBA + REST Web Services, create an
            integration record (consumer key/secret) and an access token (token id/secret), then
            paste the five values below.
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
            <Lock className="h-4 w-4 shrink-0 text-slate-400" /> Stored server-side; used to read accounts and post journal entries.
          </div>
          <Button className="mt-5" onClick={connect} disabled={busy || status.fields.some((f) => !creds[f.key]?.trim())}>
            {busy ? 'Connecting…' : 'Connect NetSuite'}
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
                  <p className="text-xs text-slate-400">Posts approved expenses as journal entries</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy}>Disconnect</Button>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Account mapping</h2>
                <p className="text-sm text-slate-400">Map each category to a NetSuite expense account, and pick the account to credit. Pulled live via SuiteQL.</p>
              </div>
              {accounts && <Button variant="outline" size="sm" onClick={applySuggestions}>✨ Suggest mappings</Button>}
            </div>

            {accountsErr && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {accountsErr} <button className="underline" onClick={() => loadAccounts()}>Retry</button>
              </div>
            )}
            {!accounts && !accountsErr && (
              <div className="flex items-center gap-2 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" /> Loading your chart of accounts…</div>
            )}

            {accounts && (
              <div className="space-y-3">
                <div className="grid items-center gap-3 sm:grid-cols-[200px_1fr]">
                  <span className="text-sm font-semibold text-slate-700">Credit account (bank / card)</span>
                  <Select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                    <option value="">Select account…</option>
                    {accounts.payment.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                  </Select>
                </div>
                <div className="my-2 border-t border-slate-100" />
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="grid items-center gap-3 sm:grid-cols-[200px_1fr]">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      {cat}
                      {suggestedFor[cat] && map[cat] && <span title={suggestedFor[cat]} className="cursor-help"><Badge color="brand">Suggested</Badge></span>}
                    </span>
                    <Select value={map[cat] || ''} onChange={(e) => setMap((m) => ({ ...m, [cat]: e.target.value }))}>
                      <option value="">Select account…</option>
                      {accounts.expense.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </Select>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={saveMapping} disabled={busy}>Save mapping</Button>
                  {mapSaved && <span className="flex items-center gap-1 text-sm text-emerald-700"><Check className="h-4 w-4" /> Saved</span>}
                  <span className="text-xs text-slate-400">{mappedCount}/{CATEGORIES.length} mapped</span>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Post expenses</h2>
                <p className="text-sm text-slate-400">
                  {postable.length ? `${postable.length} approved ready to post to NetSuite.` : 'Everything approved has been posted.'}
                </p>
              </div>
              <Button onClick={runSync} disabled={busy || postable.length === 0 || !paymentAccountId || mappedCount === 0}>
                {busy ? 'Posting…' : `Post ${postable.length || ''} to NetSuite`}
              </Button>
            </div>
            {results && results.length > 0 && (
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-4 py-2.5 font-semibold">Expense</th><th className="px-4 py-2.5 font-semibold">Result</th></tr></thead>
                  <tbody>
                    {results.map((r) => {
                      const exp = state.expenses.find((e) => e.id === r.id);
                      return (
                        <tr key={r.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-slate-700">{exp ? `${exp.merchant} · ${money2(exp.amount)}` : r.id}</td>
                          <td className="px-4 py-2.5">
                            {r.ok ? <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><Check className="h-4 w-4" /> Posted{r.extId ? ` (JE ${r.extId})` : ''}</span> : <span className="text-rose-700">{r.error}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
