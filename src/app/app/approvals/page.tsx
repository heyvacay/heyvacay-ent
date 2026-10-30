'use client';

import { useStore } from '@/lib/store';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/app/ui';
import { money, money2, dateRange, shortDate } from '@/lib/format';
import { Plane, Receipt, Shield, Check } from '@/components/icons';

export default function ApprovalsPage() {
  const { state, userById, setExpenseStatus } = useStore();

  const trips = state.bookings.filter((b) => b.status === 'pending_approval');
  const expenses = state.expenses.filter((e) => e.status === 'submitted');
  const awaiting =
    trips.reduce((s, b) => s + b.price, 0) +
    expenses.reduce((s, e) => s + e.amount, 0);
  const clear = trips.length === 0 && expenses.length === 0;

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Everything waiting on you — trips and expenses, in one place."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Trips to review" value={trips.length} />
        <StatCard label="Expenses to review" value={expenses.length} />
        <StatCard accent label="Value awaiting" value={money(awaiting)} />
      </div>

      {clear ? (
        <div className="mt-6">
          <EmptyState
            title="You're all caught up"
            sub="No trips or expenses are waiting on your approval."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {trips.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
                Trips awaiting approval
              </h2>
              <div className="space-y-3">
                {trips.map((b) => (
                  <Card
                    key={b.id}
                    className="flex flex-col gap-4 sm:flex-row sm:items-center"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                      {b.type === 'flight' ? (
                        <Plane className="h-5 w-5" />
                      ) : (
                        <Receipt className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-800">{b.title}</p>
                        <Badge color="amber">
                          <Shield className="h-3 w-3" /> Needs approval
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-400">{b.detail}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        {b.guestName || userById(b.travelerId)?.name} · {b.department} ·{' '}
                        {dateRange(b.startDate, b.endDate)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <div className="text-right">
                        <p className="font-display text-lg font-bold text-slate-900">
                          {money(b.price)}
                        </p>
                        {b.savings > 0 && (
                          <p className="text-xs font-semibold text-emerald-600">
                            saved {money(b.savings)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" href={`/app/approvals/${b.id}`}>
                          Review &amp; decide
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {expenses.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
                Expenses awaiting review
              </h2>
              <div className="space-y-3">
                {expenses.map((e) => (
                  <Card
                    key={e.id}
                    className="flex flex-col gap-4 sm:flex-row sm:items-center"
                  >
                    <Avatar name={userById(e.userId)?.name ?? '?'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-800">
                          {e.merchant}
                        </p>
                        <Badge color="slate">{e.category}</Badge>
                        {!e.hasReceipt && (
                          <span className="text-xs font-medium text-amber-600">
                            No receipt
                          </span>
                        )}
                      </div>
                      {e.note && (
                        <p className="mt-0.5 text-sm text-slate-400">{e.note}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {userById(e.userId)?.name} · {shortDate(e.date)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <p className="font-display text-lg font-bold text-slate-900">
                        {money2(e.amount)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => setExpenseStatus(e.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setExpenseStatus(e.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {!clear && (
        <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-400">
          <Check className="h-3.5 w-3.5" /> Approving a trip awards its points;
          declining cancels it. Approved expenses post to your accounting
          integration automatically.
        </p>
      )}
    </div>
  );
}
