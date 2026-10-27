'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@/components/app/ui';
import { money, num, dateRange, daysUntil } from '@/lib/format';
import { BookingChat } from '@/components/app/BookingChat';
import { Plane, Receipt } from '@/components/icons';
import type { Booking } from '@/lib/types';

function TripCard({
  b,
  onCancel,
  onDetails,
}: {
  b: Booking;
  onCancel: (id: string) => void;
  onDetails: (b: Booking) => void;
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
        {b.reviewNote && b.reviewNoteVisible && (
          <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">
              {b.status === 'cancelled' ? 'Declined' : 'Approved'} with a note:
            </span>{' '}
            “{b.reviewNote}”
          </p>
        )}
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onDetails(b)}>
            View details
          </Button>
          {b.status !== 'cancelled' && !past && (
            <Button size="sm" variant="ghost" onClick={() => onCancel(b.id)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function DetailsModal({ b, onClose }: { b: Booking; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {b.images && b.images.length > 0 && (
          <div className="grid grid-cols-3 gap-1">
            {b.images.slice(0, 3).map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className={`h-28 w-full object-cover ${i === 0 ? 'col-span-3 h-40' : ''}`} />
            ))}
          </div>
        )}
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-slate-900">{b.title}</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">
              ✕
            </button>
          </div>
          <p className="text-sm text-slate-500">{b.detail}</p>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            {b.roomType && <Row k="Room" v={b.roomType} />}
            {b.destination && <Row k="Destination" v={b.destination} />}
            <Row k="Dates" v={dateRange(b.startDate, b.endDate)} />
            <Row k="Total" v={money(b.price)} />
            {b.savings > 0 && <Row k="Saved vs market" v={money(b.savings)} tone="emerald" />}
            <Row k="Points earned" v={`+${num(b.pointsEarned)}`} tone="brand" />
            <Row k="Status" v={b.status.replace('_', ' ')} />
          </div>
          {b.travelerNote && (
            <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
              <span className="font-semibold">Your note:</span> {b.travelerNote}
            </p>
          )}
          {b.reviewNote && b.reviewNoteVisible && (
            <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
              <span className="font-semibold">Manager:</span> “{b.reviewNote}”
            </p>
          )}
          {(b.chat?.length || b.status === 'pending_approval') && (
            <BookingChat bookingId={b.id} role="traveler" />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'emerald' | 'brand' }) {
  return (
    <div className="mt-1 flex justify-between first:mt-0">
      <span className="text-slate-500">{k}</span>
      <span
        className={`font-semibold capitalize ${
          tone === 'emerald' ? 'text-emerald-600' : tone === 'brand' ? 'text-brand-dark' : 'text-slate-800'
        }`}
      >
        {v}
      </span>
    </div>
  );
}

export default function TripsPage() {
  const { state, activeUser, cancelBooking } = useStore();
  const [details, setDetails] = useState<Booking | null>(null);

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
                  <TripCard key={b.id} b={b} onCancel={cancelBooking} onDetails={setDetails} />
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
                  <TripCard key={b.id} b={b} onCancel={cancelBooking} onDetails={setDetails} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {details && <DetailsModal b={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
