'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@/components/app/ui';
import { money, num, dateRange } from '@/lib/format';
import { Plane, Receipt, Shield, Check, Gift, Wallet } from '@/components/icons';

export default function ApprovalDetail({ id }: { id: string }) {
  const { state, userById, spentForScope, approveBooking, cancelBooking } =
    useStore();
  const [note, setNote] = useState('');
  const [done, setDone] = useState<null | 'approved' | 'declined'>(null);

  const b = state.bookings.find((x) => x.id === id);

  if (!b) {
    return (
      <div>
        <Link href="/app/approvals" className="text-sm font-medium text-brand-dark hover:underline">
          ← Back to approvals
        </Link>
        <div className="mt-4">
          <EmptyState title="Trip not found" sub="It may have been removed." />
        </div>
      </div>
    );
  }

  const traveler = userById(b.travelerId);
  const booker = userById(b.bookedById);
  const empBudget = state.budgets.find(
    (x) => x.scope === 'employee' && x.refId === b.travelerId
  );
  const deptBudget = state.budgets.find(
    (x) => x.scope === 'department' && x.refId === b.department
  );
  const budget = empBudget ?? deptBudget;
  const spent = empBudget
    ? spentForScope('employee', b.travelerId)
    : spentForScope('department', b.department);
  const afterPct =
    budget && budget.limit > 0
      ? Math.min(100, Math.round(((spent + b.price) / budget.limit) * 100))
      : null;
  const overBudget = budget ? spent + b.price > budget.limit : false;

  const priceHoldNote =
    b.type === 'hotel'
      ? b.freeCancellation
        ? 'Free-cancellation rate — the price is held by the reservation. If you decline, it cancels at no cost before the deadline.'
        : 'Non-refundable rate — RateHawk prices are live and cannot be held, so the fare is re-confirmed the moment you approve. If it has moved materially, the traveler is asked to re-confirm before it books.'
      : 'Airfare is re-priced at ticketing — approve promptly to lock the quoted fare; a material change bounces back to the traveler.';

  const decide = (kind: 'approved' | 'declined') => {
    if (kind === 'approved') approveBooking(b.id, note.trim() || undefined);
    else cancelBooking(b.id, note.trim() || undefined);
    setDone(kind);
  };

  const pending = b.status === 'pending_approval';

  return (
    <div className="pb-10">
      <Link
        href="/app/approvals"
        className="text-sm font-medium text-brand-dark hover:underline"
      >
        ← Back to approvals
      </Link>

      <PageHeader
        title="Review trip"
        subtitle="Everything you need to make the call — in one place."
      />

      {done && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="font-semibold text-emerald-700">
            {done === 'approved' ? 'Trip approved' : 'Trip declined'}
            {done === 'approved' && ' — points awarded to the traveler.'}
          </p>
          <div className="mt-3">
            <Button href="/app/approvals" size="sm">
              Back to approvals
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* itinerary */}
          <Card>
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                {b.type === 'flight' ? (
                  <Plane className="h-6 w-6" />
                ) : (
                  <Receipt className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    {b.title}
                  </h2>
                  {b.status === 'pending_approval' && (
                    <Badge color="amber">
                      <Shield className="h-3 w-3" /> Needs approval
                    </Badge>
                  )}
                  {b.status === 'confirmed' && <Badge color="green">Approved</Badge>}
                  {b.status === 'cancelled' && <Badge color="slate">Declined</Badge>}
                </div>
                <p className="mt-0.5 text-slate-500">{b.detail}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {dateRange(b.startDate, b.endDate)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Price</p>
                <p className="font-display text-lg font-bold text-slate-900">
                  {money(b.price)}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-600">Saved vs market</p>
                <p className="font-display text-lg font-bold text-emerald-700">
                  {money(b.savings)}
                </p>
              </div>
              <div className="rounded-xl bg-brand/10 p-4">
                <p className="text-xs text-brand-dark">Points</p>
                <p className="font-display text-lg font-bold text-brand-dark">
                  +{num(b.pointsEarned)}
                </p>
              </div>
            </div>
          </Card>

          {/* policy breakdown */}
          <Card>
            <h3 className="mb-3 font-display text-lg font-bold text-slate-900">
              Why this needs a decision
            </h3>
            {b.policyNotes && b.policyNotes.length > 0 ? (
              <ul className="space-y-2">
                {b.policyNotes.map((n, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
                  >
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <Check className="h-4 w-4" /> This trip is within policy.
              </p>
            )}
          </Card>

          {/* budget impact */}
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
              <Wallet className="h-5 w-5 text-brand-dark" /> Budget impact
            </h3>
            {budget ? (
              <>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {empBudget ? `${traveler?.name}'s budget` : `${b.department} budget`}
                  </span>
                  <span
                    className={
                      overBudget ? 'font-semibold text-amber-600' : 'text-slate-600'
                    }
                  >
                    {money(spent + b.price)} of {money(budget.limit)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${overBudget ? 'bg-amber-500' : 'bg-brand'}`}
                    style={{ width: `${afterPct ?? 0}%` }}
                  />
                </div>
                {overBudget && (
                  <p className="mt-2 text-sm font-medium text-amber-600">
                    Approving this trip puts the {empBudget ? 'traveler' : 'department'} over budget.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">No budget set for this traveler.</p>
            )}
          </Card>

          {/* price hold */}
          <Card className="bg-slate-50">
            <h3 className="mb-1 font-display text-sm font-bold text-slate-900">
              Price &amp; cancellation
            </h3>
            <p className="text-sm text-slate-500">{priceHoldNote}</p>
          </Card>
        </div>

        {/* decision rail */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Traveler
            </h3>
            <div className="mt-2 flex items-center gap-3">
              <Avatar name={traveler?.name ?? '?'} />
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">
                  {traveler?.name}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {traveler?.title} · {b.department}
                </p>
                {traveler?.email && (
                  <p className="truncate text-xs text-slate-400">{traveler.email}</p>
                )}
              </div>
            </div>
            {booker && booker.id !== b.travelerId && (
              <p className="mt-2 text-xs text-slate-400">Booked by {booker.name}</p>
            )}

            <div className="mt-5 border-t border-slate-100 pt-4">
              {pending && !done ? (
                <>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Add a comment
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Optional note to the traveler…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button className="flex-1" onClick={() => decide('approved')}>
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => decide('declined')}
                    >
                      Decline
                    </Button>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <Gift className="h-3 w-3" /> Approving awards the traveler{' '}
                    {num(b.pointsEarned)} points.
                  </p>
                </>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {b.status === 'confirmed' ? 'Approved' : 'Declined'}
                  </p>
                  {b.reviewNote && (
                    <p className="mt-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-500">
                      “{b.reviewNote}”
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
