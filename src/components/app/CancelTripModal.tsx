'use client';

import { useState } from 'react';
import { Button, Badge, cn } from '@/components/app/ui';
import { money, dateRange } from '@/lib/format';
import { Check, Shield } from '@/components/icons';
import {
  refundQuote,
  refundSummaryLine,
  refundTimeline,
  TRIP_CANCEL_REASONS,
  tripCancelReasonLabel,
  type TripCancelReason,
} from '@/lib/cancellation';
import { cancelLiveTrip } from '@/lib/liveBooking';
import type { Booking } from '@/lib/types';

/**
 * Cancel-a-trip modal for the traveler + admin surfaces. Copies heyvacay.co:
 * the refund (or the penalty) is shown clearly BEFORE confirming, and a full
 * summary is shown AFTER cancelling. Hotels collect a reason; flights don't
 * (airfare is non-refundable, same as heyvacay).
 */
export function CancelTripModal({
  booking,
  onClose,
  onConfirm,
}: {
  booking: Booking;
  onClose: () => void;
  onConfirm: (details: {
    reason: string;
    comment?: string;
    refundAmount: number;
    cancelDeadline?: string;
  }) => void;
}) {
  const quote = refundQuote({
    type: booking.type,
    price: booking.price,
    freeCancellation: booking.freeCancellation,
    freeUntil: booking.cancelDeadline,
    startDate: booking.startDate,
  });
  const isFlight = booking.type === 'flight';
  const [phase, setPhase] = useState<'confirm' | 'done' | 'support'>('confirm');
  const [reason, setReason] = useState<TripCancelReason | ''>('');
  const [otherText, setOtherText] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [busy, setBusy] = useState(false);
  // The refund we actually show on the summary — the supplier's figure for a
  // live booking, else the quoted estimate.
  const [finalRefund, setFinalRefund] = useState(quote.refundable);

  const submit = async () => {
    if (!isFlight && !reason) {
      setReasonError(true);
      return;
    }
    const comment = isFlight
      ? undefined
      : reason === 'other'
        ? `Other: ${otherText.trim()}`.trim()
        : tripCancelReasonLabel(reason);

    let refund = quote.refundable;
    // Real supplier booking → cancel it for real. If live booking is off (501)
    // we still record the cancellation locally.
    if (booking.supplierRef) {
      setBusy(true);
      const res = await cancelLiveTrip({
        type: booking.type,
        supplierRef: booking.supplierRef,
        comment,
      });
      setBusy(false);
      if (res.supportRequired) {
        setPhase('support');
        return;
      }
      if (typeof res.refundAmount === 'number') refund = res.refundAmount;
    }

    setFinalRefund(refund);
    onConfirm({
      reason: isFlight ? 'flight_cancel' : reason || 'other',
      comment,
      refundAmount: refund,
      cancelDeadline: booking.cancelDeadline,
    });
    setPhase('done');
  };

  const title = booking.title;
  const sub = booking.roomType || booking.detail;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[94vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'confirm' ? (
          <div className="p-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Confirm cancellation</h2>
            <p className="mt-1 text-sm text-slate-500">
              You&apos;re about to cancel this booking. Please review the details carefully.
            </p>

            {/* trip summary */}
            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">{title}</p>
              {sub && <p className="text-sm text-slate-500">{sub}</p>}
              <p className="text-xs text-slate-400">{dateRange(booking.startDate, booking.endDate)}</p>
            </div>

            {/* price / refund breakdown */}
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">Price breakdown</p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Your booking amount</span>
                <span className="text-slate-800">{money(quote.total)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-slate-500">Cancellation fee</span>
                {quote.penalty > 0 ? (
                  <span className="font-medium text-slate-800">−{money(quote.penalty)}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    <Check className="h-3 w-3" /> Free cancellation
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-slate-100 pt-2">
                <span className="font-semibold text-slate-700">Refund amount</span>
                <span
                  className={cn(
                    'font-display text-xl font-bold',
                    quote.refundable > 0 ? 'text-emerald-600' : 'text-slate-400'
                  )}
                >
                  {money(quote.refundable)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">{quote.note}</p>
              {quote.refundable > 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  Refunded to {quote.refundMethod} within {refundTimeline(booking.type)}.
                </p>
              )}
            </div>

            {/* reason (hotels only, like heyvacay) */}
            {!isFlight && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">
                  Help us improve — why are you cancelling?
                </p>
                <div className="mt-2 space-y-1.5">
                  {TRIP_CANCEL_REASONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => {
                        setReason(r.value);
                        setReasonError(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition',
                        reason === r.value
                          ? 'border-brand bg-brand/5 text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                    >
                      <span
                        className={cn(
                          'grid h-4 w-4 place-items-center rounded-full border',
                          reason === r.value ? 'border-brand bg-brand' : 'border-slate-300'
                        )}
                      >
                        {reason === r.value && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      {r.label}
                    </button>
                  ))}
                </div>
                {reason === 'other' && (
                  <textarea
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    rows={2}
                    placeholder="Tell us more (optional)"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand"
                  />
                )}
                {reasonError && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    Please select a reason for your cancellation.
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Go back
              </Button>
              <Button
                onClick={submit}
                disabled={busy}
                className="bg-red-500 text-white hover:bg-red-600"
              >
                {busy ? 'Cancelling…' : 'Cancel booking'}
              </Button>
            </div>
          </div>
        ) : phase === 'support' ? (
          <div className="p-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Contact support to cancel</h2>
            <p className="mt-2 text-sm text-slate-500">
              This booking can&apos;t be cancelled online. Please contact our support team and
              we&apos;ll cancel it for you.
            </p>
            <Button className="mt-5 w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          /* -------- post-cancel summary -------- */
          <div className="p-6">
            <div className="text-center">
              <span
                className={cn(
                  'mx-auto grid h-14 w-14 place-items-center rounded-full',
                  finalRefund > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                )}
              >
                <Check className="h-7 w-7" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">Booking cancelled</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {refundSummaryLine(
                  { refundable: finalRefund, refundMethod: quote.refundMethod },
                  booking.type,
                  false,
                  money
                )}
              </p>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 p-4 text-sm">
              <Row k="Trip" v={title} />
              {sub && <Row k="Room" v={sub} />}
              <Row k="Dates" v={dateRange(booking.startDate, booking.endDate)} />
              {booking.supplierRef && <Row k="Reference" v={booking.supplierRef} mono />}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status</span>
                <Badge color="red">Cancelled</Badge>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-slate-500">Refund amount</span>
                <span className="font-semibold text-slate-900">{money(finalRefund)}</span>
              </div>
              {finalRefund > 0 && (
                <>
                  <Row k="Refunded to" v={quote.refundMethod} />
                  <Row k="Expected" v={refundTimeline(booking.type)} />
                </>
              )}
            </div>

            {finalRefund > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                A confirmation email is on its way. The refund posts to {quote.refundMethod} within{' '}
                {refundTimeline(booking.type)}.
              </p>
            )}

            <Button className="mt-5 w-full" onClick={onClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{k}</span>
      <span className={cn('text-right text-slate-800', mono && 'font-mono text-xs')}>{v}</span>
    </div>
  );
}
