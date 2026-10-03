'use client';

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
    companySpend,
    companySavings,
    spentForScope,
    userById,
    approveBooking,
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
  const recent = [...state.bookings]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 6);

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
                        {userById(b.travelerId)?.name} · {money(b.price)}
                      </p>
                    </div>
                    <Badge color="amber">Review</Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => approveBooking(b.id)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost">
                      Details
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
        <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Recent bookings
          </h2>
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
                    {userById(b.travelerId)?.name}
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
