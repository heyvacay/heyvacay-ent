'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  cn,
} from '@/components/app/ui';
import { money, num, dateRange, daysUntil, todayISO } from '@/lib/format';
import { BookingChat } from '@/components/app/BookingChat';
import { CancelTripModal } from '@/components/app/CancelTripModal';
import { Plane, Receipt, Sparkles, MapPin } from '@/components/icons';
import type { Booking } from '@/lib/types';

function TripCard({
  b,
  onCancel,
  onDetails,
  travelerName,
}: {
  b: Booking;
  onCancel: (b: Booking) => void;
  onDetails: (b: Booking) => void;
  travelerName?: string;
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
        {travelerName && (
          <p className="text-xs font-semibold text-brand-dark">{travelerName}</p>
        )}
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
            <Button size="sm" variant="ghost" onClick={() => onCancel(b)}>
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
            {b.eventName && <Row k="Event" v={b.eventName} />}
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
  const { state, role, activeUser, fullAccess, directReportIds, userById, cancelTrip } = useStore();
  const [details, setDetails] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const isAdmin = role === 'admin';
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [person, setPerson] = useState<'all' | string>('all');
  const [dept, setDept] = useState<'all' | string>('all');

  // Full-access viewers (owner, finance, anyone the company grants it) see the
  // whole company; a team manager sees their department plus their reports.
  const myReports = directReportIds(activeUser.id);
  const teamUsers = state.users.filter(
    (u) =>
      u.status === 'active' &&
      (fullAccess || u.department === activeUser.department || myReports.includes(u.id))
  );
  const teamDepartments = Array.from(new Set(teamUsers.map((u) => u.department).filter(Boolean))).sort();
  const nameOf = (id: string) => userById(id)?.name ?? '—';

  const viewingTeam = isAdmin && scope === 'team';
  const mine = state.bookings
    .filter((b) => {
      if (!viewingTeam) return b.travelerId === activeUser.id;
      // Team view: trips of the people I manage, with person/sub-team filters.
      const u = userById(b.travelerId);
      if (!u || !teamUsers.some((t) => t.id === u.id)) return false;
      if (dept !== 'all' && u.department !== dept) return false;
      if (person !== 'all' && u.id !== person) return false;
      return true;
    })
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  const today = todayISO();
  // Trips happening right now — the interface shifts to on-trip actions.
  const activeNow = mine.filter(
    (b) =>
      b.status === 'confirmed' &&
      ((b.type === 'hotel' && b.startDate <= today && b.endDate >= today) ||
        (b.type === 'flight' && b.startDate === today))
  );
  const upcoming = mine.filter(
    (b) => b.status !== 'cancelled' && daysUntil(b.endDate) >= 0 && !activeNow.includes(b)
  );
  const past = mine.filter(
    (b) => b.status === 'cancelled' || daysUntil(b.endDate) < 0
  );
  const expensesForTrip = (id: string) =>
    state.expenses.filter((e) => e.tripId === id);

  return (
    <div>
      <PageHeader
        title="Trips"
        subtitle={
          viewingTeam
            ? `Bookings across ${fullAccess ? 'the company' : 'your team'}.`
            : "Everything you've booked, past and upcoming."
        }
        actions={<Button href="/app/book">Book travel</Button>}
      />

      {/* admin: my vs team, with person / sub-team filters */}
      {isAdmin && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                ['mine', 'My trips'],
                ['team', fullAccess ? "Company trips" : "My team's trips"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setScope(k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  scope === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {viewingTeam && (
            <div className="flex flex-wrap gap-2">
              {fullAccess && (
                <Select value={dept} onChange={(e) => setDept(e.target.value)} className="sm:w-44">
                  <option value="all">All sub-teams</option>
                  {teamDepartments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              )}
              <Select value={person} onChange={(e) => setPerson(e.target.value)} className="sm:w-48">
                <option value="all">Everyone</option>
                {teamUsers
                  .filter((u) => dept === 'all' || u.department === dept)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </Select>
            </div>
          )}
        </div>
      )}

      {mine.length === 0 ? (
        <EmptyState
          title="No trips found"
          sub={viewingTeam ? 'No trips match this filter.' : 'Your booked flights and hotels will appear here.'}
        />
      ) : (
        <div className="space-y-8">
          {!viewingTeam && activeNow.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
                On your trip now
              </h2>
              <div className="space-y-3">
                {activeNow.map((b) => {
                  const spent = expensesForTrip(b.id);
                  const total = spent.reduce((s, e) => s + e.amount, 0);
                  return (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-brand/40 bg-brand/5 p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-dark">
                            {b.type === 'flight' ? (
                              <Plane className="h-5 w-5" />
                            ) : (
                              <MapPin className="h-5 w-5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{b.title}</p>
                            <p className="text-xs text-slate-500">
                              {b.destination || ''} · {dateRange(b.startDate, b.endDate)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {spent.length} expense{spent.length === 1 ? '' : 's'} logged
                              {total > 0 ? ` · ${money(total)}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button href={`/app/expenses?scan=1&trip=${b.id}`}>
                            <Sparkles className="h-4 w-4" /> Scan receipt
                          </Button>
                          <Button variant="outline" href={`/app/expenses?new=1&trip=${b.id}`}>
                            <Receipt className="h-4 w-4" /> Add expense
                          </Button>
                          <Button variant="ghost" onClick={() => setDetails(b)}>
                            Manage
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing upcoming" sub="Time to plan your next trip." />
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => (
                  <TripCard key={b.id} b={b} onCancel={setCancelTarget} onDetails={setDetails} travelerName={b.guestName || (viewingTeam ? nameOf(b.travelerId) : undefined)} />
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
                  <TripCard key={b.id} b={b} onCancel={setCancelTarget} onDetails={setDetails} travelerName={b.guestName || (viewingTeam ? nameOf(b.travelerId) : undefined)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {details && <DetailsModal b={details} onClose={() => setDetails(null)} />}

      {cancelTarget && (
        <CancelTripModal
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={(d) => cancelTrip(cancelTarget.id, d)}
        />
      )}
    </div>
  );
}
