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
import { money, dateRange } from '@/lib/format';
import { Plane, Receipt, Shield, Check } from '@/components/icons';

export default function ApprovalsPage() {
  const { state, userById } = useStore();

  // Travel approvals are for bookings only — hotels, flights and car rentals.
  // Expense review lives in the Expenses section.
  const trips = state.bookings.filter((b) => b.status === 'pending_approval');
  const awaiting = trips.reduce((s, b) => s + b.price, 0);
  const clear = trips.length === 0;

  return (
    <div>
      <PageHeader
        title="Travel approvals"
        subtitle="Hotels, flights and car rentals waiting on your approval. Expenses are reviewed in the Expenses section."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Trips to review" value={trips.length} />
        <StatCard accent label="Value awaiting" value={money(awaiting)} />
      </div>

      {clear ? (
        <div className="mt-6">
          <EmptyState
            title="You're all caught up"
            sub="No trips are waiting on your approval. Expenses are reviewed in Expenses."
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

        </div>
      )}

      {!clear && (
        <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-400">
          <Check className="h-3.5 w-3.5" /> Approving a trip awards its points;
          declining asks for a reason and lets the traveler revise and resubmit.
        </p>
      )}
    </div>
  );
}
