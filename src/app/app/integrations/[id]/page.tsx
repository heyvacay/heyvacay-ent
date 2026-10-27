'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  StatCard,
} from '@/components/app/ui';
import { money2, shortDate } from '@/lib/format';
import { ACCOUNTING_IDS } from '@/lib/seed';
import { Check, Lock, Receipt, Users } from '@/components/icons';
import { IntegrationLogo } from '@/components/app/IntegrationLogo';
import type { ExpenseCategory } from '@/lib/types';

const CATEGORIES: ExpenseCategory[] = [
  'Meals',
  'Ground transport',
  'Lodging',
  'Airfare',
  'Supplies',
  'Other',
];
const HR_IDS = ['workday', 'bamboohr', 'rippling', 'gusto'];

export default function IntegrationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const {
    state,
    setIntegrationStatus,
    setGlMapping,
    syncExpense,
    syncAllApproved,
  } = useStore();

  const integration = state.integrations.find((i) => i.id === id);
  const [connecting, setConnecting] = useState(false);
  const [rosterSynced, setRosterSynced] = useState(false);

  const postable = useMemo(
    () =>
      state.expenses.filter(
        (e) =>
          (e.status === 'approved' || e.status === 'reimbursed') && !e.synced
      ),
    [state.expenses]
  );
  const synced = useMemo(
    () => state.expenses.filter((e) => e.synced),
    [state.expenses]
  );

  if (!integration) {
    return (
      <div>
        <PageHeader title="Integration" />
        <EmptyState title="Not found" sub="This integration doesn't exist." />
        <div className="mt-4">
          <Button href="/app/integrations" variant="outline" size="sm">
            ← All integrations
          </Button>
        </div>
      </div>
    );
  }

  const connected = integration.status === 'connected';
  const isAccounting = ACCOUNTING_IDS.includes(integration.id);
  const isHr = HR_IDS.includes(integration.id);

  const connect = () => {
    setConnecting(true);
    setTimeout(() => {
      setIntegrationStatus(integration.id, 'connected');
      setConnecting(false);
    }, 900);
  };

  return (
    <div>
      <Link
        href="/app/integrations"
        className="mb-4 inline-block text-sm font-medium text-slate-400 hover:text-slate-600"
      >
        ← All integrations
      </Link>

      <PageHeader
        title={integration.name}
        subtitle={integration.blurb}
        actions={
          connected ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIntegrationStatus(integration.id, 'available')}
            >
              Disconnect
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 flex items-center gap-3">
        <IntegrationLogo id={integration.id} name={integration.name} className="h-12 w-12" />
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {integration.category}
          </p>
          {connected ? (
            <Badge color="green">
              <Check className="h-3 w-3" /> Connected
            </Badge>
          ) : integration.status === 'requested' ? (
            <Badge color="amber">Requested in onboarding</Badge>
          ) : (
            <Badge color="slate">Not connected</Badge>
          )}
        </div>
      </div>

      {/* ---- not connected: connect panel ---- */}
      {!connected && (
        <Card className="max-w-xl">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Connect {integration.name}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isAccounting
              ? `Expenses will post to ${integration.name} against the right GL codes automatically — reconciled, no receipts chased.`
              : isHr
                ? `We'll keep your people, roles, and departments in sync from ${integration.name}.`
                : `Sync ${integration.name} so your team's data stays current across HeyVacay.`}
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <Lock className="h-4 w-4 shrink-0 text-slate-400" />
            Read-only by default. You choose what syncs, and you can disconnect
            anytime.
          </div>
          <Button className="mt-5" onClick={connect} disabled={connecting}>
            {connecting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-deep/30 border-t-navy-deep" />
                Authorizing…
              </>
            ) : (
              <>Connect {integration.name}</>
            )}
          </Button>
        </Card>
      )}

      {/* ---- connected: accounting ---- */}
      {connected && isAccounting && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Ready to post" value={postable.length} sub="Approved, not yet synced" />
            <StatCard label="Posted" value={synced.length} sub={`to ${integration.name}`} />
            <StatCard accent label="Reconciliation" value="Automatic" sub="Matched to GL codes" />
          </div>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Chart-of-accounts mapping
                </h2>
                <p className="text-sm text-slate-400">
                  Each expense category posts to this {integration.name} account.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {CATEGORIES.map((cat) => (
                <div
                  key={cat}
                  className="grid items-center gap-3 sm:grid-cols-[180px_1fr]"
                >
                  <span className="text-sm font-medium text-slate-700">{cat}</span>
                  <Input
                    value={state.accountingMap[cat] ?? ''}
                    onChange={(e) => setGlMapping(cat, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Post expenses
                </h2>
                <p className="text-sm text-slate-400">
                  {postable.length
                    ? `${postable.length} approved ${postable.length === 1 ? 'expense is' : 'expenses are'} ready to post to ${integration.name}.`
                    : 'Everything approved is posted. New approvals post automatically.'}
                </p>
              </div>
              <Button onClick={syncAllApproved} disabled={postable.length === 0}>
                Post {postable.length || ''} to {integration.name}
              </Button>
            </div>

            {synced.length > 0 && (
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 font-semibold">Merchant</th>
                      <th className="px-4 py-2.5 font-semibold">GL account</th>
                      <th className="px-4 py-2.5 font-semibold">Date</th>
                      <th className="px-4 py-2.5 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {synced.slice(0, 6).map((e) => (
                      <tr key={e.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-slate-700">
                          {e.merchant}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {e.glCode ?? state.accountingMap[e.category]}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                          {shortDate(e.date)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {money2(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ---- connected: HR ---- */}
      {connected && isHr && (
        <Card className="max-w-xl">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/12 text-brand-dark">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Roster sync
              </h2>
              <p className="text-sm text-slate-400">
                Import people, departments, and new hires from {integration.name}.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-600">
              {state.users.length} people in your workspace
            </span>
            {rosterSynced ? (
              <Badge color="green">
                <Check className="h-3 w-3" /> Synced just now
              </Badge>
            ) : (
              <Button size="sm" onClick={() => setRosterSynced(true)}>
                Sync roster
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            New hires are invited automatically; departures are deactivated — your
            travel program stays current without manual upkeep.
          </p>
        </Card>
      )}

      {/* ---- connected: other ---- */}
      {connected && !isAccounting && !isHr && (
        <Card className="max-w-xl">
          <div className="flex items-center gap-2 text-emerald-700">
            <Check className="h-5 w-5" />
            <p className="font-semibold">{integration.name} is connected</p>
          </div>
          <p className="mt-2 text-sm text-slate-500">{integration.blurb}</p>
          <div className="mt-4 space-y-2">
            {[
              'Keeping data in sync in real time',
              'Events flow to the right people automatically',
              'No manual exports or spreadsheets',
            ].map((t) => (
              <div
                key={t}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600"
              >
                <Check className="h-4 w-4 text-brand-dark" /> {t}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
