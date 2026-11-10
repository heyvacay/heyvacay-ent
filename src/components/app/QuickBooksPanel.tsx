'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, Select } from '@/components/app/ui';
import { Check, Lock } from '@/components/icons';
import { money2, shortDate } from '@/lib/format';
import { recommendMappings } from '@/lib/integrations/quickbooksMapping';
import type { ExpenseCategory, Integration } from '@/lib/types';

const CATEGORIES: ExpenseCategory[] = [
  'Meals',
  'Ground transport',
  'Lodging',
  'Airfare',
  'Supplies',
  'Other',
];

interface QboAccountOpt {
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
  realmId: string | null;
  connectedAt: string | null;
  accountMap: Record<string, string>;
  paymentAccountId: string | null;
}

interface SyncResultRow {
  id: string;
  ok: boolean;
  qboId?: string;
  viewUrl?: string;
  error?: string;
  verified?: boolean;
  verifyNote?: string;
  duplicate?: boolean;
}

/**
 * Real QuickBooks Online panel: OAuth connect, live chart-of-accounts mapping,
 * and posting approved expenses as QuickBooks Purchases. Replaces the simulated
 * connect flow for the `quickbooks` integration.
 */
export function QuickBooksPanel({ integration }: { integration: Integration }) {
  const { state, setIntegrationStatus, syncExpense } = useStore();
  const companyId = state.company.id;
  const params = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [accounts, setAccounts] = useState<{ expense: QboAccountOpt[]; payment: QboAccountOpt[] } | null>(null);
  const [accountsErr, setAccountsErr] = useState<string | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [savingMap, setSavingMap] = useState(false);
  const [mapSaved, setMapSaved] = useState(false);
  // Categories filled by the recommendation engine and not yet hand-edited,
  // with the reason to show on the row. Cleared per-row on manual change.
  const [suggestedFor, setSuggestedFor] = useState<Record<string, string>>({});
  const [paymentSuggested, setPaymentSuggested] = useState(false);
  const [showSuggestBanner, setShowSuggestBanner] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResultRow[] | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Approved-but-not-yet-synced expenses are what we post.
  const postable = useMemo(
    () =>
      state.expenses.filter(
        (e) => (e.status === 'approved' || e.status === 'reimbursed') && !e.synced
      ),
    [state.expenses]
  );
  const synced = useMemo(() => state.expenses.filter((e) => e.synced), [state.expenses]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/quickbooks/status?companyId=${encodeURIComponent(companyId)}`);
      const data = (await res.json()) as StatusResp;
      setStatus(data);
      setMap(data.accountMap || {});
      setPaymentAccountId(data.paymentAccountId || '');
      // Keep the list badge honest.
      setIntegrationStatus('quickbooks', data.connected ? 'connected' : 'available');
      return data;
    } catch {
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [companyId, setIntegrationStatus]);

  const loadAccounts = useCallback(async () => {
    setAccountsErr(null);
    try {
      const res = await fetch(`/api/integrations/quickbooks/accounts?companyId=${encodeURIComponent(companyId)}`);
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

  // Initial load + react to the OAuth callback redirect (?qbo=connected|error).
  useEffect(() => {
    const qbo = params.get('qbo');
    if (qbo === 'connected') {
      setBanner({ kind: 'ok', text: `Connected to QuickBooks${params.get('company') ? ` — ${params.get('company')}` : ''}.` });
    } else if (qbo === 'error') {
      setBanner({ kind: 'err', text: `QuickBooks connection failed: ${params.get('reason') || 'unknown error'}.` });
    }
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once we know we're connected, pull the live chart of accounts.
  useEffect(() => {
    if (status?.connected) void loadAccounts();
  }, [status?.connected, loadAccounts]);

  const connect = () => {
    window.location.href = `/api/integrations/quickbooks/connect?companyId=${encodeURIComponent(companyId)}`;
  };

  // Fill empty rows with smart recommendations (only touches blanks, so it
  // never clobbers a choice the admin already made). Flags each filled row as a
  // suggestion to review and shows the review banner.
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

  // Mark a category as hand-chosen (drops the "suggested" flag on it).
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
      const res = await fetch('/api/integrations/quickbooks/mapping', {
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
      const res = await fetch('/api/integrations/quickbooks/sync', {
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
      // Mark the ones that posted as synced in the local workspace.
      for (const r of (data.results || []) as SyncResultRow[]) {
        if (r.ok) syncExpense(r.id);
      }
      setBanner({
        kind: data.failed ? 'err' : 'ok',
        text: `Posted ${data.posted} to QuickBooks${data.failed ? `, ${data.failed} failed` : ''}.`,
      });
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/integrations/quickbooks/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      setAccounts(null);
      setSyncResults(null);
      await loadStatus();
      setBanner({ kind: 'ok', text: 'QuickBooks disconnected.' });
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
          Checking QuickBooks connection…
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

      {/* Server not wired yet — honest message, no fake connect. */}
      {status && !status.serverConfigured && (
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            QuickBooks is a real OAuth connection, not a one-click demo. The Intuit app
            credentials aren&apos;t wired on the server yet — once they are, this button turns
            into a live &ldquo;Connect to QuickBooks&rdquo; consent flow.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            Waiting on the Intuit app client id / secret (server configuration).
          </div>
        </Card>
      )}

      {/* Configured but not connected — real OAuth connect. */}
      {status && status.serverConfigured && !status.connected && (
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">Connect {integration.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Approved expenses will post to QuickBooks as Purchases against the GL accounts
            you map — reconciled automatically, no manual exports.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge color={status.env === 'production' ? 'green' : 'amber'}>
              {status.env === 'production' ? 'Production' : 'Sandbox'}
            </Badge>
            <span className="text-xs text-slate-400">
              You&apos;ll sign in to Intuit and authorize HeyVacay to post expenses.
            </span>
          </div>
          <Button className="mt-5" onClick={connect}>
            Connect to QuickBooks
          </Button>
        </Card>
      )}

      {/* Connected — mapping + sync. */}
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
                    {status.env === 'production' ? 'Production' : 'Sandbox'} company
                    {status.realmId ? ` · realm ${status.realmId}` : ''}
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
                  Route each expense category to a real QuickBooks account, and pick the
                  account purchases are paid from. Pulled live from your QuickBooks.
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
                closest QuickBooks account by its type and name — please <strong>review every row
                carefully</strong> (hover a “Suggested” tag to see why it was picked) and adjust
                anything that isn&apos;t right before you save. Nothing posts to QuickBooks until you
                sync.
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
                    {paymentSuggested && paymentAccountId && (
                      <Badge color="brand">Suggested</Badge>
                    )}
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
                    <Select
                      value={map[cat] || ''}
                      onChange={(e) => setMapManual(cat, e.target.value)}
                    >
                      <option value="">Select GL account…</option>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Post expenses</h2>
                <p className="text-sm text-slate-400">
                  {postable.length
                    ? `${postable.length} approved ${postable.length === 1 ? 'expense is' : 'expenses are'} ready to post to QuickBooks.`
                    : 'Everything approved has been posted.'}
                </p>
              </div>
              <Button
                onClick={runSync}
                disabled={syncing || postable.length === 0 || !paymentAccountId || mappedCount === 0}
              >
                {syncing ? 'Posting…' : `Post ${postable.length || ''} to QuickBooks`}
              </Button>
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
                                  <Check className="h-4 w-4" /> View in QuickBooks
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
                {synced.length} expense{synced.length === 1 ? '' : 's'} posted to QuickBooks so far.
                Most recent: {shortDate(synced[0]?.date)}.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
