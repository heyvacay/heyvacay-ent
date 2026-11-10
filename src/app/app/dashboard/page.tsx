'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  ProgressBar,
  StatCard,
} from '@/components/app/ui';
import { money, pct, dateRange } from '@/lib/format';
import { Plane, Receipt } from '@/components/icons';

export default function AdminDashboard() {
  const {
    state,
    activeUser,
    isSuperAdmin,
    companySpend,
    companySavings,
    spentForScope,
    userById,
    directReportIds,
  } = useStore();

  const companyBudget =
    state.budgets.find((b) => b.scope === 'company')?.limit ?? 0;
  const belowMarket =
    companySpend + companySavings > 0
      ? companySavings / (companySpend + companySavings)
      : 0;
  const pending = state.bookings.filter((b) => b.status === 'pending_approval');
  const activeEmployees = state.users.filter((u) => u.status === 'active').length;
  const deptBudgets = state.budgets.filter((b) => b.scope === 'department');
  // Recent bookings, split by who they belong to: mine, my team's (my direct
  // and indirect reports), and — for a company-wide (super) admin — everyone's.
  const sortedBookings = useMemo(
    () =>
      [...state.bookings].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [state.bookings]
  );
  const teamIds = useMemo(
    () => new Set([activeUser.id, ...directReportIds(activeUser.id)]),
    [activeUser.id, directReportIds]
  );
  const scopes = useMemo(() => {
    const base: { key: 'mine' | 'team' | 'company'; label: string }[] = [
      { key: 'mine', label: 'My bookings' },
      { key: 'team', label: "My team's" },
    ];
    if (isSuperAdmin) base.push({ key: 'company', label: "Company's" });
    return base;
  }, [isSuperAdmin]);
  const [scope, setScope] = useState<'mine' | 'team' | 'company'>('mine');
  const effectiveScope = scopes.some((s) => s.key === scope) ? scope : 'mine';
  const recent = useMemo(() => {
    const filtered =
      effectiveScope === 'company'
        ? sortedBookings
        : effectiveScope === 'team'
          ? sortedBookings.filter((b) => teamIds.has(b.travelerId))
          : sortedBookings.filter((b) => b.travelerId === activeUser.id);
    return filtered.slice(0, 6);
  }, [effectiveScope, sortedBookings, teamIds, activeUser.id]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${state.company.name} · live travel & expense across the company`}
        actions={<Button href="/app/people" variant="outline" size="sm">Invite people</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Spend this year"
          value={money(companySpend)}
          sub={`of ${money(companyBudget)} budget`}
        />
        <StatCard
          accent
          label="Savings delivered"
          value={money(companySavings)}
          sub={`${pct(belowMarket)} below market`}
        />
        <StatCard
          label="Pending approvals"
          value={pending.length}
          sub={pending.length ? 'Needs your review' : 'All clear'}
        />
        <StatCard
          label="Active travelers"
          value={activeEmployees}
          sub={`${state.users.length} people total`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* budgets */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Budget by department
            </h2>
            <Button href="/app/budgets" variant="ghost" size="sm">
              Manage
            </Button>
          </div>
          <div className="space-y-5">
            {deptBudgets.map((b) => {
              const spent = spentForScope('department', b.refId);
              const over = spent > b.limit;
              const nearly = spent / b.limit > 0.8;
              return (
                <div key={b.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{b.label}</span>
                    <span className="text-slate-500">
                      {money(spent)}{' '}
                      <span className="text-slate-300">/ {money(b.limit)}</span>
                    </span>
                  </div>
                  <ProgressBar
                    value={spent}
                    max={b.limit}
                    tone={over ? 'red' : nearly ? 'amber' : 'brand'}
                  />
                </div>
              );
            })}
          </div>
        </Card>

        {/* approvals */}
        <Card>
          <h2 className="mb-4 font-display text-lg font-bold text-slate-900">
            Approvals
          </h2>
          {pending.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
              Nothing waiting on you.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {b.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {b.guestName || userById(b.travelerId)?.name} · {money(b.price)}
                      </p>
                    </div>
                    <Badge color="amber">Review</Badge>
                  </div>
                  <div className="mt-3">
                    <Button size="sm" href={`/app/approvals/${b.id}`} className="w-full">
                      Review &amp; decide
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* recent activity */}
      <Card className="mt-6" pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Recent bookings
            </h2>
            {scopes.length > 1 && (
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                {scopes.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setScope(s.key)}
                    className={
                      effectiveScope === s.key
                        ? 'rounded-md bg-white px-3 py-1 text-slate-800 shadow-sm'
                        : 'rounded-md px-3 py-1 text-slate-500 hover:text-slate-700'
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button href="/app/bookings" variant="ghost" size="sm">
            View all
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold sm:px-6">Trip</th>
                <th className="px-5 py-3 font-semibold">Traveler</th>
                <th className="px-5 py-3 font-semibold">Dates</th>
                <th className="px-5 py-3 font-semibold">Price</th>
                <th className="px-5 py-3 font-semibold">Saved</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400 sm:px-6">
                    {effectiveScope === 'mine'
                      ? 'No bookings of your own yet.'
                      : effectiveScope === 'team'
                        ? "No bookings from your team yet."
                        : 'No bookings yet.'}
                  </td>
                </tr>
              )}
              {recent.map((b) => (
                <tr key={b.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500">
                        {b.type === 'flight' ? (
                          <Plane className="h-4 w-4" />
                        ) : (
                          <Receipt className="h-4 w-4" />
                        )}
                      </span>
                      <div>
                        <p className="font-medium text-slate-800">{b.title}</p>
                        <p className="text-xs text-slate-400">{b.department}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {b.guestName || userById(b.travelerId)?.name}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                    {dateRange(b.startDate, b.endDate)}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {money(b.price)}
                  </td>
                  <td className="px-5 py-3 font-semibold text-emerald-600">
                    {money(b.savings)}
                  </td>
                  <td className="px-5 py-3">
                    {b.status === 'confirmed' && <Badge color="green">Confirmed</Badge>}
                    {b.status === 'pending_approval' && <Badge color="amber">Pending</Badge>}
                    {b.status === 'cancelled' && <Badge color="slate">Cancelled</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
