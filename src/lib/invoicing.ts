import type { Booking } from './types';
import {
  invoicePeriodKey,
  invoicePeriodPaid,
  INVOICE_TAX_RATE,
  INVOICE_DUE_DAYS,
  INVOICE_LATE_PCT_PER_WEEK,
} from './dunning';

export interface InvoiceLine {
  booking: Booking;
  travelerName: string;
  department: string;
  title: string;
  nights: number;
  base: number;
  tax: number;
  total: number;
}

export interface Invoice {
  period: string; // YYYY-MM
  number: string; // display invoice number
  issued: string; // YYYY-MM-DD
  due: string; // YYYY-MM-DD
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  weeksLate: number;
  lateFee: number;
  amountDue: number; // total + lateFee
  reported: boolean; // payment reported for this period
}

function nightsBetween(a: string, b: string): number {
  const n = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return n > 0 ? n : 1;
}

/**
 * Build invoiced periods from a set of bookings. Confirmed bookings are grouped
 * into 30-day (calendar-month) periods, itemized, taxed, and dated Net 10 with
 * a 3%/week late fee past due. Shared by the traveler Invoice Center and the
 * CRM Invoicing Center.
 */
export function buildInvoices(
  bookings: Booking[],
  opts: {
    userName: (id: string) => string;
    userTitle?: (id: string) => string;
    isPaid?: (period: string) => boolean;
    now?: number;
  }
): Invoice[] {
  const now = opts.now ?? Date.now();
  const isPaid = opts.isPaid ?? invoicePeriodPaid;
  const title = opts.userTitle ?? (() => '—');
  const confirmed = (bookings ?? []).filter((b) => b.status === 'confirmed');
  const byPeriod = new Map<string, Booking[]>();
  for (const b of confirmed) {
    const k = invoicePeriodKey(b.createdAt);
    byPeriod.set(k, [...(byPeriod.get(k) ?? []), b]);
  }
  return Array.from(byPeriod.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([period, list]) => {
      const lines: InvoiceLine[] = list.map((b) => {
        const base = Math.round(b.price / (1 + INVOICE_TAX_RATE));
        return {
          booking: b,
          travelerName: b.guestName || opts.userName(b.travelerId),
          department: b.department || '—',
          title: title(b.travelerId),
          nights: b.type === 'hotel' ? nightsBetween(b.startDate, b.endDate) : 0,
          base,
          tax: b.price - base,
          total: b.price,
        };
      });
      const subtotal = lines.reduce((s, l) => s + l.base, 0);
      const tax = lines.reduce((s, l) => s + l.tax, 0);
      const total = subtotal + tax;
      const issued = `${period}-28`;
      const due = new Date(new Date(issued).getTime() + INVOICE_DUE_DAYS * 86400000)
        .toISOString()
        .slice(0, 10);
      const weeksLate = Math.max(
        0,
        Math.ceil((now - new Date(due).getTime()) / (7 * 86400000))
      );
      const lateFee = weeksLate > 0 ? Math.ceil(total * INVOICE_LATE_PCT_PER_WEEK * weeksLate) : 0;
      return {
        period,
        number: period.replace('-', ''),
        issued,
        due,
        lines,
        subtotal,
        tax,
        total,
        weeksLate,
        lateFee,
        amountDue: total + lateFee,
        reported: isPaid(period),
      };
    });
}
