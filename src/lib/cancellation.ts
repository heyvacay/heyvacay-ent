/**
 * Cancellation + refund quoting, shared by the traveler, admin and Nova
 * surfaces. Mirrors heyvacay.co: we show the refund (or the penalty) clearly
 * BEFORE the user confirms, then a full summary after cancelling.
 *
 * For a live booking the supplier's cancel endpoint returns the authoritative
 * refund; this quote is what we show up front and for the workspace's own
 * (demo) bookings, computed from the rate's free-cancellation terms.
 */

export type RefundOutcome = 'full' | 'partial' | 'none';

export type TripCancelReason =
  | 'found_better'
  | 'plans_changed'
  | 'wrong_dates'
  | 'concerns'
  | 'approval'
  | 'other';

// The same reason set heyvacay.co offers on its cancel page.
export const TRIP_CANCEL_REASONS: { value: TripCancelReason; label: string }[] = [
  { value: 'found_better', label: 'Found a better price elsewhere' },
  { value: 'plans_changed', label: 'Change in travel plans' },
  { value: 'wrong_dates', label: 'Incorrect booking dates' },
  { value: 'concerns', label: 'Concerns about the booking' },
  { value: 'approval', label: 'Visa or travel approval issues' },
  { value: 'other', label: 'Other' },
];

export function tripCancelReasonLabel(v?: string): string {
  return TRIP_CANCEL_REASONS.find((r) => r.value === v)?.label ?? v ?? '—';
}

/** How long refunds take to land — hotels settle faster than airline refunds. */
export function refundTimeline(type: string): string {
  return type === 'flight' ? '5–10 business days' : '5–7 business days';
}

export interface RefundQuote {
  outcome: RefundOutcome;
  /** Amount returned to the payer. */
  refundable: number;
  /** Amount kept (supplier penalty). */
  penalty: number;
  /** The original charge. */
  total: number;
  currency: string;
  /** Whether the rate had a free-cancellation window at all. */
  freeCancellation: boolean;
  /** Whether we're still inside that free-cancellation window. */
  withinFreeWindow: boolean;
  /** The free-cancellation deadline (ISO date), when known. */
  freeUntil?: string;
  /** Where the money goes back to. */
  refundMethod: string;
  /** Short badge-style label: "Full refund" / "Partial refund" / "Non-refundable". */
  headline: string;
  /** One-line plain-English explanation shown under the amount. */
  note: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Quote the refund for cancelling a trip right now.
 *
 * Hotels: a free-cancellation rate is fully refundable until its deadline (or,
 * if no explicit deadline, until check-in); after that, or for a non-refundable
 * rate, nothing comes back. Flights: airfare is non-refundable once ticketed.
 */
export function refundQuote(args: {
  type: 'hotel' | 'flight' | string;
  price: number;
  currency?: string;
  freeCancellation?: boolean;
  freeUntil?: string; // deadline ISO
  startDate: string; // stay / flight date ISO
  refundMethod?: string;
  todayISO?: string;
}): RefundQuote {
  const total = Math.max(0, Math.round(args.price));
  const currency = args.currency || 'USD';
  const today = args.todayISO || todayStr();
  const refundMethod = args.refundMethod || 'the original payment method';
  const freeCancellation = Boolean(args.freeCancellation);
  const deadline = args.freeUntil || args.startDate;
  const withinFreeWindow = freeCancellation && today <= deadline;

  const base = {
    total,
    currency,
    freeCancellation,
    withinFreeWindow,
    freeUntil: args.freeUntil || undefined,
    refundMethod,
  };

  if (args.type === 'flight') {
    return {
      ...base,
      outcome: 'none',
      refundable: 0,
      penalty: total,
      headline: 'Non-refundable',
      note: "The airline doesn't refund this fare, so you won't get money back if you cancel. Cancelling releases the seat.",
    };
  }

  if (withinFreeWindow) {
    return {
      ...base,
      outcome: 'full',
      refundable: total,
      penalty: 0,
      headline: 'Full refund',
      note: args.freeUntil
        ? `This rate is free to cancel through ${fmt(deadline)} — you get the full amount back.`
        : 'This rate is free to cancel — you get the full amount back.',
    };
  }

  if (freeCancellation) {
    return {
      ...base,
      outcome: 'none',
      refundable: 0,
      penalty: total,
      headline: 'Non-refundable',
      note: `The free-cancellation window closed on ${fmt(deadline)}, so this stay is now non-refundable.`,
    };
  }

  return {
    ...base,
    outcome: 'none',
    refundable: 0,
    penalty: total,
    headline: 'Non-refundable',
    note: 'This was a non-refundable rate, so cancelling does not return the amount paid.',
  };
}

/**
 * The plain-English refund line for the post-cancel summary, matching
 * heyvacay.co. `processed` is true once the refund has actually settled.
 */
export function refundSummaryLine(
  quote: Pick<RefundQuote, 'refundable' | 'refundMethod'>,
  type: string,
  processed: boolean,
  fmtMoney: (n: number) => string
): string {
  if (quote.refundable <= 0) return 'There is no refund for this booking.';
  if (processed) return `We refunded ${fmtMoney(quote.refundable)} to ${quote.refundMethod}.`;
  return `We're refunding ${fmtMoney(quote.refundable)} to ${quote.refundMethod}. It usually shows within ${refundTimeline(type)}.`;
}

function fmt(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
