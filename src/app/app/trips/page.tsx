'use client';

import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@/components/app/ui';
import { money, num, dateRange, daysUntil } from '@/lib/format';
import { Plane, Receipt } from '@/components/icons';
import type { Booking } from '@/lib/types';

function TripCard({
  b,
  onCancel,
}: {
  b: Booking;
  onCancel: (id: string) => void;
}) {
  const savings = b.savings;
  const days = daysUntil(b.startDate);
  const past = daysUntil(b.endDate) < 0;
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
          {b.status === 'pending_approval' && (
            <Badge color="amber">Pending approval</Badge>
          )}
          {b.status === 'cancelled' && <Badge color="slate">Cancelled</Badge>}
          {b.status === 'confirmed' && !past && (
            <Badge color="brand">{days <= 0 ? 'In progress' : `in ${days}d`}</Badge>
          )}
          {b.status === 'confirmed' && past && (
            <Badge color="green">Completed</Badge>
          )}
        </div>
        <p className="mt-0.5 text-sm text-slate-400">{b.detail}</p>
        <p className="mt-1 text-xs text-slate-400">
          {dateRange(b.startDate, b.endDate)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
        <div className="text-right">
          <p className="font-display text-lg font-bold text-slate-900">
            {money(b.price)}
          </p>
          {savings > 0 && (
            <p className="text-xs font-semibold text-emerald-600">
              saved {money(savings)} · +{num(b.pointsEarned)} pts
            </p>
          )}
        </div>
        {b.status !== 'cancelled' && !past && (
          <Button size="sm" variant="ghost" onClick={() => onCancel(b.id)}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function TripsPage() {
  const { state, activeUser, cancelBooking } = useStore();

  const mine = state.bookings
    .filter((b) => b.travelerId === activeUser.id)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  const upcoming = mine.filter(
    (b) => b.status !== 'cancelled' && daysUntil(b.endDate) >= 0
  );
  const past = mine.filter(
    (b) => b.status === 'cancelled' || daysUntil(b.endDate) < 0
  );

  return (
    <div>
      <PageHeader
        title="My trips"
        subtitle="Everything you've booked, past and upcoming."
        actions={<Button href="/app/book">Book travel</Button>}
      />

      {mine.length === 0 ? (
        <EmptyState
          title="No trips yet"
          sub="Your booked flights and hotels will appear here."
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing upcoming" sub="Time to plan your next trip." />
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => (
                  <TripCard key={b.id} b={b} onCancel={cancelBooking} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
                Past &amp; cancelled
              </h2>
              <div className="space-y-3">
                {past.map((b) => (
                  <TripCard key={b.id} b={b} onCancel={cancelBooking} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
