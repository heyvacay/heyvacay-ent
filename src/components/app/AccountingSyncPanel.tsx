'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, Select } from '@/components/app/ui';
import { Check, Lock } from '@/components/icons';
import { money2, shortDate } from '@/lib/format';
import { recommendMappings } from '@/lib/integrations/quickbooksMapping';
import type { ExpenseCategory, Integration } from '@/lib/types';

/**
 * Provider-agnostic accounting sync panel: OAuth connect, live chart-of-accounts
 * mapping (with smart suggestions), and posting approved expenses — reused by
 * QuickBooks and Xero (and any future accounting integration of the same shape).
 */
export interface AccountingProvider {
  /** Route segment + integration id, e.g. 'quickbooks' | 'xero'. */
  id: string;
  /** Display name, e.g. 'QuickBooks' | 'Xero'. */
  name: string;
  /** OAuth provider shown to the user, e.g. 'Intuit' | 'Xero'. */
  authProvider: string;
  /** What the server needs wired, e.g. 'Intuit app' | 'Xero app'. */
  appLabel: string;
  /** What a posted expense becomes, e.g. 'Purchases' | 'spend transactions'. */
  postNoun: string;
  /** GL select placeholder, e.g. 'Select GL account…' | 'Select account…'. */
  glPlaceholder: string;
  /** Organisation noun, e.g. 'realm' | 'organisation'. */
  orgNoun: string;
}

const CATEGORIES: ExpenseCategory[] = [
  'Meals',
  'Ground transport',
  'Lodging',
  'Airfare',
  'Supplies',
  'Other',
];

interface AcctOpt {
  id: string;
  name: string;
  type: string;
}

interface StatusResp {
  serverConfigured: boolean;
  env: string;
  connected: boolean;
  status: string;
  companyName: string | null;
  orgId: string | null;
  connectedAt: string | null;
  accountMap: Record<string, string>;
  paymentAccountId: string | null;
}

interface SyncResultRow {
  id: string;
  ok: boolean;
  viewUrl?: string;
  error?: string;
  verified?: boolean;
  verifyNote?: string;
  duplicate?: boolean;
}

export function AccountingSyncPanel({
  integration,
  provider,
}: {
  integration: Integration;
  provider: AccountingProvider;
}) {
  const { state, setIntegrationStatus, syncExpense } = useStore();
  const companyId = state.company.id;
  const params = useSearchParams();
  const api = `/api/integrations/${provider.id}`;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [accounts, setAccounts] = useState<{ expense: AcctOpt[]; payment: AcctOpt[] } | null>(null);
  const [accountsErr, setAccountsErr] = useState<string | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [savingMap, setSavingMap] = useState(false);
  const [mapSaved, setMapSaved] = useState(false);
  const [suggestedFor, setSuggestedFor] = useState<Record<string, string>>({});
  const [paymentSuggested, setPaymentSuggested] = useState(false);
  const [showSuggestBanner, setShowSuggestBanner] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResultRow[] | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Posting scope — a real, per-company setting controlling which approved
  // expenses get posted: everything, only company-card charges, or only
  // personal/reimbursable ones. Persisted per company + provider.
  const scopeKey = `hv_post_scope_${companyId}_${provider.id}`;
  const [postScope, setPostScope] = useState<'all' | 'company' | 'personal'>('all');
  useEffect(() => {
    try {
      const v = localStorage.getItem(scopeKey);
      if (v === 'all' || v === 'company' || v === 'personal') setPostScope(v);
    } catch {
      /* ignore */
    }
  }, [scopeKey]);
  const changeScope = (v: 'all' | 'company' | 'personal') => {
    setPostScope(v);
    try {
      localStorage.setItem(scopeKey, v);
    } catch {
      /* ignore */
    }
  };

  // Posting mode — when expenses flow into the accounting system automatically.
  //   on_approval : posts the moment an expense is approved (default)
  //   on_submit   : posts as soon as it's submitted, before approval
  //   manual      : nothing posts until someone clicks "Post"
  // When an already-posted expense is later rejected, it's pulled back out of
  // the accounting system automatically (both auto modes). Persisted per
  // company + provider; the background engine (AccountingAutoSync) reads it.
  type PostMode = 'on_approval' | 'on_submit' | 'manual';
  const modeKey = `hv_post_mode_${companyId}_${provider.id}`;
  const [postMode, setPostMode] = useState<PostMode>('on_approval');
  useEffect(() => {
    try {
      const v = localStorage.getItem(modeKey);
      if (v === 'on_approval' || v === 'on_submit' || v === 'manual') setPostMode(v);
    } catch {
      /* ignore */
    }
  }, [modeKey]);
  const changeMode = (v: PostMode) => {
    setPostMode(v);
    try {
      localStorage.setItem(modeKey, v);
      // Let the background sync engine react immediately in this tab.
      window.dispatchEvent(new CustomEvent('hv-post-mode-changed'));
    } catch {
      /* ignore */
    }
  };

  const postable = useMemo(
    () =>
      state.expenses.filter((e) => {
        if (!((e.status === 'approved' || e.status === 'reimbursed') && !e.synced)) return false;
        const personal = e.paidWith === 'personal' || e.reimbursable;
        if (postScope === 'company') return !personal;
        if (postScope === 'personal') return !!personal;
        return true;
      }),
    [state.expenses, postScope]
  );
  const synced = useMemo(() => state.expenses.filter((e) => e.synced), [state.expenses]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${api}/status?companyId=${encodeURIComponent(companyId)}`);
      const data = (await res.json()) as StatusResp;
      setStatus(data);
      setMap(data.accountMap || {});
      setPaymentAccountId(data.paymentAccountId || '');
      setIntegrationStatus(provider.id, data.connected ? 'connected' : 'available');
      return data;
    } catch {
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [api, companyId, provider.id, setIntegrationStatus]);

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
  }, [api, companyId]);

  useEffect(() => {
    const conn = params.get('conn');
    if (conn === 'connected') {
      setBanner({ kind: 'ok', text: `Connected to ${provider.name}${params.get('company') ? ` — ${params.get('company')}` : ''}.` });
    } else if (conn === 'error') {
      setBanner({ kind: 'err', text: `${provider.name} connection failed: ${params.get('reason') || 'unknown error'}.` });
    }
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status?.connected) void loadAccounts();
  }, [status?.connected, loadAccounts]);

  const connect = () => {
    window.location.href = `${api}/connect?companyId=${encodeURIComponent(companyId)}`;
  };

  const applySuggestions = () => {
    if (!accounts) return;
    const rec = recommendMappings(accounts.expense, accounts.payment);
    const nextMap = { ...map };
    const nextSuggested: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      if (!nextMap[cat] && rec.accountMap[cat]) {
        nextMap[cat] = rec.accountMap[cat];
        nextSuggested[cat] = rec.reasons[cat] || 'Recommended match';
      }
    }
    setMap(nextMap);
    setSuggestedFor((prev) => ({ ...prev, ...nextSuggested }));
    if (!paymentAccountId && rec.paymentAccountId) {
      setPaymentAccountId(rec.paymentAccountId);
      setPaymentSuggested(true);
    }
    setShowSuggestBanner(true);
  };

  const setMapManual = (cat: string, value: string) => {
    setMap((m) => ({ ...m, [cat]: value }));
    setSuggestedFor((prev) => {
      if (!prev[cat]) return prev;
      const next = { ...prev };
      delete next[cat];
      return next;
    });
  };

  const saveMapping = async () => {
    setSavingMap(true);
    setMapSaved(false);
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
        setBanner({ kind: 'err', text: d?.error || 'Could not save the mapping.' });
      }
    } finally {
      setSavingMap(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setSyncResults(null);
    try {
      const res = await fetch(`${api}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          expenses: postable.map((e) => ({
            id: e.id,
            merchant: e.merchant,
            category: e.category,
            amount: e.amount,
            date: e.date,
            note: e.note,
            paidWith: e.paidWith,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: 'err', text: data?.error || 'Sync failed.' });
        return;
      }
      setSyncResults(data.results || []);
      for (const r of (data.results || []) as SyncResultRow[]) {
        if (r.ok) syncExpense(r.id);
      }
      setBanner({
        kind: data.failed ? 'err' : 'ok',
        text: `Posted ${data.posted} to ${provider.name}${data.failed ? `, ${data.failed} failed` : ''}.`,
      });
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch(`${api}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      setAccounts(null);
      setSyncResults(null);
      await loadStatus();
      setBanner({ kind: 'ok', text: `${provider.name} disconnected.` });
    } finally {
      setDisconnecting(false);
    }
  };

  const mappedCount = CATEGORIES.filter((c) => map[c]).length;

  if (loading) {
    return (
      <Card className="max-w-xl">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Checking {provider.name} connection…
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

      {status && !status.serverConfigured && (
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {provider.name} uses a live OAuth connection, not a one-click demo. The {provider.appLabel}{' '}
            credentials aren&apos;t wired on the server yet — once they are, this turns into a live
            &ldquo;Connect to {provider.name}&rdquo; consent flow.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            Waiting on the {provider.appLabel} client id / secret (server configuration).
          </div>
        </Card>
      )}

      {status && status.serverConfigured && !status.connected && (
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Approved expenses will post to {provider.name} as {provider.postNoun} against the accounts
            you map — reconciled automatically, no manual exports.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge color={status.env === 'production' ? 'green' : 'amber'}>
              {status.env === 'production' ? 'Production' : 'Sandbox'}
            </Badge>
            <span className="text-xs text-slate-400">
              You&apos;ll sign in to {provider.authProvider} and authorize HeyVacay to post expenses.
            </span>
          </div>
          <Button className="mt-5" onClick={connect}>
            Connect to {provider.name}
          </Button>
        </Card>
      )}

      {status && status.connected && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Check className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-800">
                    Connected{status.companyName ? ` — ${status.companyName}` : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    {status.env === 'production' ? 'Production' : 'Sandbox'}
                    {status.orgId ? ` · ${provider.orgNoun} ${status.orgId}` : ''}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Chart-of-accounts mapping</h2>
                <p className="text-sm text-slate-400">
                  Route each expense category to a real {provider.name} account, and pick the account
                  purchases are paid from. Pulled live from your {provider.name}.
                </p>
              </div>
              {accounts && (
                <Button variant="outline" size="sm" onClick={applySuggestions}>
                  ✨ Suggest mappings
                </Button>
              )}
            </div>

            {showSuggestBanner && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
                <strong>These are suggestions, not final.</strong> We matched each category to the
                closest {provider.name} account by its type and name — please <strong>review every row
                carefully</strong> (hover a “Suggested” tag to see why it was picked) and adjust
                anything that isn&apos;t right before you save. Nothing posts until you sync.
              </div>
            )}

            {accountsErr && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {accountsErr}{' '}
                <button className="underline" onClick={() => loadAccounts()}>
                  Retry
                </button>
              </div>
            )}

            {!accounts && !accountsErr && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                Loading your chart of accounts…
              </div>
            )}

            {accounts && (
              <div className="space-y-3">
                <div className="grid items-center gap-3 sm:grid-cols-[200px_1fr]">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    Paid from (bank / card)
                    {paymentSuggested && paymentAccountId && <Badge color="brand">Suggested</Badge>}
                  </span>
                  <Select
                    value={paymentAccountId}
                    onChange={(e) => {
                      setPaymentAccountId(e.target.value);
                      setPaymentSuggested(false);
                    }}
                  >
                    <option value="">Select payment account…</option>
                    {accounts.payment.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="my-2 border-t border-slate-100" />
                {CATEGORIES.map((cat) => (
                  <div key={cat} className="grid items-center gap-3 sm:grid-cols-[200px_1fr]">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      {cat}
                      {suggestedFor[cat] && map[cat] && (
                        <span title={suggestedFor[cat]} className="cursor-help">
                          <Badge color="brand">Suggested</Badge>
                        </span>
                      )}
                    </span>
                    <Select value={map[cat] || ''} onChange={(e) => setMapManual(cat, e.target.value)}>
                      <option value="">{provider.glPlaceholder}</option>
                      {accounts.expense.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={saveMapping} disabled={savingMap}>
                    {savingMap ? 'Saving…' : 'Save mapping'}
                  </Button>
                  {mapSaved && (
                    <span className="flex items-center gap-1 text-sm text-emerald-700">
                      <Check className="h-4 w-4" /> Saved
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {mappedCount}/{CATEGORIES.length} categories mapped
                  </span>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">Automatic posting</h2>
              <p className="text-sm text-slate-400">
                Decide when expenses flow into {provider.name}. In either automatic mode, an expense
                that&apos;s <strong>rejected after it was posted</strong> is pulled back out of {provider.name} for you.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { v: 'on_approval', title: 'When approved', desc: `Posts to ${provider.name} the moment an expense is approved. Recommended.` },
                { v: 'on_submit', title: 'When submitted', desc: `Posts as soon as it's submitted — even before approval. Removed if it's later rejected.` },
                { v: 'manual', title: 'Manually', desc: `Nothing posts on its own. You click "Post" below when you're ready.` },
              ] as { v: PostMode; title: string; desc: string }[]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => changeMode(opt.v)}
                  className={
                    'rounded-xl border p-4 text-left transition ' +
                    (postMode === opt.v
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-950/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900')
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{opt.title}</span>
                    {postMode === opt.v && <Check className="h-4 w-4 text-brand-600" />}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{opt.desc}</p>
                </button>
              ))}
            </div>
            {postMode !== 'manual' && (!paymentAccountId || mappedCount === 0) && (
              <p className="mt-3 text-xs text-amber-600">
                Automatic posting won&apos;t run until the mapping above is finished (payment account +
                at least one category).
              </p>
            )}
          </Card>

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Post expenses</h2>
                <p className="text-sm text-slate-400">
                  {postable.length
                    ? `${postable.length} approved ${postable.length === 1 ? 'expense is' : 'expenses are'} ready to post to ${provider.name}.`
                    : 'Everything approved has been posted.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={postScope}
                  onChange={(e) => changeScope(e.target.value as 'all' | 'company' | 'personal')}
                  className="sm:w-48"
                >
                  <option value="all">All approved expenses</option>
                  <option value="company">Company-card only</option>
                  <option value="personal">Personal / reimbursable only</option>
                </Select>
                <Button
                  onClick={runSync}
                  disabled={syncing || postable.length === 0 || !paymentAccountId || mappedCount === 0}
                >
                  {syncing ? 'Posting…' : `Post ${postable.length || ''} to ${provider.name}`}
                </Button>
              </div>
            </div>
            {(!paymentAccountId || mappedCount === 0) && postable.length > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Finish the mapping above (payment account + at least one category) before posting.
              </p>
            )}

            {syncResults && syncResults.length > 0 && (
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 font-semibold">Expense</th>
                      <th className="px-4 py-2.5 font-semibold">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncResults.map((r) => {
                      const exp = state.expenses.find((e) => e.id === r.id);
                      return (
                        <tr key={r.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2.5 font-medium text-slate-700">
                            {exp ? `${exp.merchant} · ${money2(exp.amount)}` : r.id}
                          </td>
                          <td className="px-4 py-2.5">
                            {r.ok ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <a
                                  className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                                  href={r.viewUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Check className="h-4 w-4" /> View in {provider.name}
                                </a>
                                <span className="text-xs text-slate-400">HV-{r.id}</span>
                                {r.duplicate ? (
                                  <Badge color="slate">Already posted</Badge>
                                ) : r.verified ? (
                                  <Badge color="green">Verified</Badge>
                                ) : (
                                  <span title={r.verifyNote} className="cursor-help">
                                    <Badge color="amber">Review</Badge>
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-rose-700">{r.error}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {synced.length > 0 && !syncResults && (
              <p className="mt-4 text-xs text-slate-400">
                {synced.length} expense{synced.length === 1 ? '' : 's'} posted so far. Most recent:{' '}
                {shortDate(synced[0]?.date)}.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
