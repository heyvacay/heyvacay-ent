'use client';

import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/app/ui';
import { money, num, dateRange, daysUntil } from '@/lib/format';
import { Plane, Receipt, Gift, ArrowRight } from '@/components/icons';

export default function MyDashboard() {
  const { state, activeUser, spentForScope, pointsBalance } = useStore();

  const myBookings = state.bookings.filter(
    (b) => b.travelerId === activeUser.id && b.status !== 'cancelled'
  );
  const upcoming = myBookings
    .filter((b) => daysUntil(b.endDate) >= 0)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const next = upcoming[0];
  const mySavings = myBookings.reduce((s, b) => s + b.savings, 0);
  const myExpenses = state.expenses.filter((e) => e.userId === activeUser.id);
  const openExpenses = myExpenses.filter((e) => e.status === 'submitted').length;
  const budget = state.budgets.find(
    (b) => b.scope === 'employee' && b.refId === activeUser.id
  );
  const spent = spentForScope('employee', activeUser.id);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${activeUser.name.split(' ')[0]}`}
        subtitle="Your trips, your rewards, your expenses — all in one place."
        actions={
          <Button href="/app/book">
            Book travel <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          accent
          label="Your points"
          value={num(pointsBalance(activeUser.id))}
          sub="Yours to keep"
        />
        <StatCard
          label="You saved the company"
          value={money(mySavings)}
          sub="Across your trips"
        />
        <StatCard
          label="Travel budget used"
          value={budget ? money(spent) : money(spent)}
          sub={budget ? `of ${money(budget.limit)}` : 'No cap set'}
        />
        <StatCard
          label="Open expenses"
          value={openExpenses}
          sub={openExpenses ? 'Awaiting review' : 'All settled'}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Upcoming trips
            </h2>
            <Button href="/app/trips" variant="ghost" size="sm">
              All trips
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              title="No trips booked"
              sub="Book your next trip in under a minute."
            />
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 4).map((b) => {
                const days = daysUntil(b.startDate);
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                      {b.type === 'flight' ? (
                        <Plane className="h-5 w-5" />
                      ) : (
                        <Receipt className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800">{b.title}</p>
                      <p className="text-xs text-slate-400">
                        {dateRange(b.startDate, b.endDate)}
                      </p>
                    </div>
                    {b.status === 'pending_approval' ? (
                      <Badge color="amber">Pending</Badge>
                    ) : (
                      <Badge color="brand">
                        {days <= 0 ? 'Now' : `in ${days}d`}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 text-brand-dark">
              <Gift className="h-5 w-5" />
            </span>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Rewards
            </h2>
          </div>
          <p className="font-display text-3xl font-extrabold text-brand-dark">
            {num(pointsBalance(activeUser.id))}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            points — because you booked smart. Spend them on your own personal
            HeyVacay getaways.
          </p>
          {next && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Next up: <span className="font-medium">{next.title}</span> in{' '}
              {Math.max(0, daysUntil(next.startDate))} days.
            </div>
          )}
          <Button href="/app/rewards" variant="outline" size="sm" className="mt-4 w-full">
            Redeem points
          </Button>
        </Card>
      </div>
    </div>
  );
}
