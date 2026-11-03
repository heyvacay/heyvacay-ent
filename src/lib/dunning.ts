import type { Booking } from './types';

/**
 * Invoiced-billing collections state. Invoices are generated every 30 days
 * from confirmed bookings (see the Invoice Center), due on Net 10. Past due:
 *   • 1–2 weeks late → 3%/week late fee (still bookable)
 *   • 3 weeks late   → invoiced (ACH) bookings disabled; a card is required
 *   • 4+ weeks late  → new bookings paused until the balance clears
 */
export type DunningLevel = 'ok' | 'late' | 'card_only' | 'paused';

const TAX_RATE = 0.0825;
const DUE_DAYS = 10;
const LATE_PCT_PER_WEEK = 0.03;

export interface DunningState {
  level: DunningLevel;
  weeksLate: number;
  /** Outstanding balance across all unpaid, issued invoices (incl. late fees). */
  balance: number;
}

/** The 30-day invoice period a booking falls into (YYYY-MM). */
export function invoicePeriodKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Compute collections state from confirmed bookings and a predicate telling us
 * which invoice periods the company has reported paid. Pure + side-effect free
 * so it can run in the store, on a page, or in a test.
 */
export function computeDunning(
  bookings: Booking[],
  isPaid: (period: string) => boolean,
  now: number = Date.now()
): DunningState {
  const confirmed = (bookings ?? []).filter((b) => b.status === 'confirmed');
  const byPeriod = new Map<string, Booking[]>();
  for (const b of confirmed) {
    const k = invoicePeriodKey(b.createdAt);
    byPeriod.set(k, [...(byPeriod.get(k) ?? []), b]);
  }

  let maxWeeksLate = 0;
  let balance = 0;
  for (const [period, list] of byPeriod) {
    if (isPaid(period)) continue;
    const total = list.reduce((s, b) => s + b.price, 0);
    const issued = new Date(`${period}-28`).getTime();
    const due = issued + DUE_DAYS * 86400000;
    const weeksLate = Math.max(0, Math.ceil((now - due) / (7 * 86400000)));
    const lateFee = weeksLate > 0 ? Math.ceil(total * LATE_PCT_PER_WEEK * weeksLate) : 0;
    // Only count issued invoices toward the outstanding balance.
    if (now >= issued) balance += total + lateFee;
    if (weeksLate > maxWeeksLate) maxWeeksLate = weeksLate;
  }

  const level: DunningLevel =
    maxWeeksLate >= 4 ? 'paused' : maxWeeksLate >= 3 ? 'card_only' : maxWeeksLate >= 1 ? 'late' : 'ok';

  return { level, weeksLate: maxWeeksLate, balance };
}

/** Per-viewer "payment reported" flag, shared with the Invoice Center. */
export function invoicePaidKey(period: string): string {
  return `hv_ent_invoice_paid_${period}`;
}

export function invoicePeriodPaid(period: string): boolean {
  try {
    return localStorage.getItem(invoicePaidKey(period)) === '1';
  } catch {
    return false;
  }
}

export { TAX_RATE as INVOICE_TAX_RATE, DUE_DAYS as INVOICE_DUE_DAYS, LATE_PCT_PER_WEEK as INVOICE_LATE_PCT_PER_WEEK };
