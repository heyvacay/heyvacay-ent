'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, PageHeader, cn } from '@/components/app/ui';
import { Shield, Check } from '@/components/icons';
import { money } from '@/lib/format';
import type { Booking } from '@/lib/types';

/** HeyVacay remit-to details shown on every invoice. */
const REMIT = {
  entity: 'HeyVacay, Inc.',
  address: '2100 Kramer Lane, Suite 300, Austin, TX 78758',
  ein: '88-1234567',
  bankName: 'Silicon Valley Bank',
  routing: '121140399',
  account: '•••• 4821',
  swift: 'SVBKUS6S',
  email: 'ar@heyvacay.co',
};

const TAX_RATE = 0.0825; // assumed sales/occupancy tax split out on each line
const DUE_DAYS = 10;
const LATE_PCT_PER_WEEK = 0.03;

type Line = {
  booking: Booking;
  travelerName: string;
  department: string;
  title: string;
  nights: number;
  tax: number;
  base: number;
  total: number;
};

function nightsBetween(a: string, b: string): number {
  const n = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return n > 0 ? n : 1;
}

/** Group confirmed bookings into monthly (30-day) invoice periods by createdAt. */
function periodKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function InvoicesPage() {
  const { state, activeUser } = useStore();
  const kyc = state.billing?.netKyc;
  const net30 = state.billing?.mode === 'net30' && kyc?.status === 'approved';

  const [detailed, setDetailed] = useState(true);
  const [paidFlash, setPaidFlash] = useState('');

  const userName = (id: string) =>
    state.users.find((u) => u.id === id)?.name ?? 'Traveler';
  const userTitle = (id: string) => state.users.find((u) => u.id === id)?.title ?? '—';

  const invoices = useMemo(() => {
    const confirmed = (state.bookings ?? []).filter((b) => b.status === 'confirmed');
    const byPeriod = new Map<string, Booking[]>();
    for (const b of confirmed) {
      const k = periodKey(b.createdAt);
      byPeriod.set(k, [...(byPeriod.get(k) ?? []), b]);
    }
    return Array.from(byPeriod.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([period, bookings]) => {
        const lines: Line[] = bookings.map((b) => {
          const base = Math.round(b.price / (1 + TAX_RATE));
          return {
            booking: b,
            travelerName: b.guestName || userName(b.travelerId),
            department: b.department || '—',
            title: userTitle(b.travelerId),
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
        const due = new Date(new Date(issued).getTime() + DUE_DAYS * 86400000)
          .toISOString()
          .slice(0, 10);
        const weeksLate = Math.max(
          0,
          Math.ceil((Date.now() - new Date(due).getTime()) / (7 * 86400000))
        );
        const lateFee = weeksLate > 0 ? Math.ceil(total * LATE_PCT_PER_WEEK * weeksLate) : 0;
        const reported = readPaid(period);
        return { period, issued, due, lines, subtotal, tax, total, weeksLate, lateFee, reported };
      });
  }, [state.bookings, state.users]);

  const current = invoices[0];

  const markPaid = (period: string) => {
    writePaid(period);
    setPaidFlash(period);
    setTimeout(() => setPaidFlash(''), 100); // trigger re-render; value re-read below
  };

  if (!net30) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Invoice Center" subtitle="Invoiced (Net 30) billing." />
        <Card>
          <p className="text-sm text-slate-500">
            Your Invoice Center opens once Net 30 is approved. Finish your KYC on the{' '}
            <Link href="/app/billing" className="font-medium text-brand-dark hover:underline">
              Billing &amp; payments
            </Link>{' '}
            page.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Invoice Center"
        subtitle="Pay invoices on Net 30 terms, or pay early. Every charge is itemized."
      />

      {/* Remit-to / bank details */}
      <Card>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
          <Shield className="h-5 w-5 text-brand-dark" /> How to pay
        </h2>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Bank transfer (ACH / wire)
            </p>
            <dl className="mt-1 space-y-0.5 text-slate-600 dark:text-slate-300">
              <Row k="Beneficiary" v={REMIT.entity} />
              <Row k="Bank" v={REMIT.bankName} />
              <Row k="Routing (ABA)" v={REMIT.routing} />
              <Row k="Account" v={REMIT.account} />
              <Row k="SWIFT" v={REMIT.swift} />
            </dl>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Remit to</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {REMIT.entity}
              <br />
              {REMIT.address}
              <br />
              EIN {REMIT.ein} · {REMIT.email}
            </p>
          </div>
        </div>
      </Card>

      {!current ? (
        <Card>
          <p className="text-sm text-slate-500">
            No invoiced bookings yet. Confirmed trips on Net 30 appear here, invoiced every 30 days.
          </p>
        </Card>
      ) : (
        <>
          {/* Current invoice actions */}
          <Card className="border-brand/30 bg-brand/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Current invoice · {money(current.total + current.lateFee)}
                </p>
                <p className="text-xs text-slate-500">
                  Issued {current.issued} · due {current.due}
                  {current.weeksLate > 0 && (
                    <span className="text-red-600">
                      {' '}
                      · {current.weeksLate} week{current.weeksLate === 1 ? '' : 's'} late ·{' '}
                      {money(current.lateFee)} late fee
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-white/10">
                  <button
                    onClick={() => setDetailed(false)}
                    className={cn('rounded-md px-2 py-1', !detailed && 'bg-brand text-navy')}
                  >
                    Invoice
                  </button>
                  <button
                    onClick={() => setDetailed(true)}
                    className={cn('rounded-md px-2 py-1', detailed && 'bg-brand text-navy')}
                  >
                    Detailed
                  </button>
                </div>
                <Button variant="outline" onClick={() => window.print()}>
                  Generate &amp; pay
                </Button>
                {readPaid(current.period) || paidFlash === current.period ? (
                  <Badge color="green">Payment reported</Badge>
                ) : (
                  <Button onClick={() => markPaid(current.period)}>
                    <Check className="h-4 w-4" /> I sent a payment
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Dunning status */}
          <DunningBanner weeksLate={current.weeksLate} />

          {/* The printable invoice */}
          {invoices.map((inv) => (
            <InvoiceSheet
              key={inv.period}
              inv={inv}
              detailed={detailed}
              company={state.company.name}
              billTo={kyc?.fields?.billingEmail || activeUser.email}
              signer={kyc?.fields?.signerName}
            />
          ))}
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function DunningBanner({ weeksLate }: { weeksLate: number }) {
  if (weeksLate <= 0) return null;
  let msg = `A 3% late fee applies for each week past the due date (${weeksLate} so far).`;
  let tone = 'bg-amber-50 text-amber-800';
  if (weeksLate >= 4) {
    msg = 'Over 4 weeks late — new bookings are paused until the balance is cleared.';
    tone = 'bg-red-50 text-red-700';
  } else if (weeksLate >= 3) {
    msg = 'Over 3 weeks late — invoiced (ACH) bookings are disabled; a credit card is required.';
    tone = 'bg-red-50 text-red-700';
  }
  return (
    <div className={cn('rounded-xl p-3 text-sm', tone)}>
      {msg} Your account manager can waive fees if you&apos;ve already arranged payment.
    </div>
  );
}

function InvoiceSheet({
  inv,
  detailed,
  company,
  billTo,
  signer,
}: {
  inv: {
    period: string;
    issued: string;
    due: string;
    lines: Line[];
    subtotal: number;
    tax: number;
    total: number;
    lateFee: number;
  };
  detailed: boolean;
  company: string;
  billTo: string;
  signer?: string;
}) {
  return (
    <Card className="print:shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-xl font-bold text-slate-900 dark:text-white">Invoice</p>
          <p className="text-xs text-slate-500">
            #{inv.period.replace('-', '')} · Issued {inv.issued} · Due {inv.due}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="font-semibold text-slate-700 dark:text-slate-200">{REMIT.entity}</p>
          <p>{REMIT.address}</p>
          <p>EIN {REMIT.ein}</p>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-600 dark:text-slate-300">Bill to:</span> {company}{' '}
        · {billTo}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 dark:border-white/10">
              {detailed ? (
                <>
                  <th className="py-1.5 pr-2">Traveler</th>
                  <th className="py-1.5 pr-2">Dept / Title</th>
                  <th className="py-1.5 pr-2">Item</th>
                  <th className="py-1.5 pr-2">Dates</th>
                  <th className="py-1.5 pr-2 text-right">Nights</th>
                  <th className="py-1.5 pr-2 text-right">Base</th>
                  <th className="py-1.5 pr-2 text-right">Tax</th>
                  <th className="py-1.5 text-right">Total</th>
                </>
              ) : (
                <>
                  <th className="py-1.5 pr-2">Item</th>
                  <th className="py-1.5 text-right">Total</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.booking.id} className="border-b border-slate-100 dark:border-white/5">
                {detailed ? (
                  <>
                    <td className="py-1.5 pr-2 font-medium text-slate-700 dark:text-slate-200">
                      {l.travelerName}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-500">
                      {l.department} · {l.title}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-500">
                      {l.booking.title}
                      {l.booking.airline ? ` · ${l.booking.airline}` : ''}
                      {l.booking.roomType ? ` · ${l.booking.roomType}` : ''}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-500">
                      {l.booking.startDate} → {l.booking.endDate}
                    </td>
                    <td className="py-1.5 pr-2 text-right">{l.nights || '—'}</td>
                    <td className="py-1.5 pr-2 text-right">{money(l.base)}</td>
                    <td className="py-1.5 pr-2 text-right">{money(l.tax)}</td>
                    <td className="py-1.5 text-right font-medium">{money(l.total)}</td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5 pr-2 text-slate-600 dark:text-slate-300">
                      {l.booking.title} — {l.travelerName}
                    </td>
                    <td className="py-1.5 text-right font-medium">{money(l.total)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
        <Row k="Subtotal" v={money(inv.subtotal)} />
        <Row k="Tax" v={money(inv.tax)} />
        {inv.lateFee > 0 && <Row k="Late fee" v={money(inv.lateFee)} />}
        <div className="flex justify-between border-t border-slate-200 pt-1 font-display text-base font-bold dark:border-white/10">
          <span>Amount due</span>
          <span>{money(inv.total + inv.lateFee)}</span>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between border-t border-slate-200 pt-3 text-xs text-slate-400 dark:border-white/10">
        <p>
          Net {DUE_DAYS} terms. Remit to {REMIT.entity}, {REMIT.bankName} routing {REMIT.routing},
          acct {REMIT.account}. Questions: {REMIT.email}.
        </p>
        <div className="text-right">
          <p className="font-[cursive] text-base text-slate-700 dark:text-slate-200">
            {signer || 'HeyVacay, Inc.'}
          </p>
          <p>Authorized · HeyVacay, Inc.</p>
        </div>
      </div>
    </Card>
  );
}

/* Payment-reported flag, kept per-period in localStorage (per-viewer). */
function paidKey(period: string) {
  return `hv_ent_invoice_paid_${period}`;
}
function readPaid(period: string): boolean {
  try {
    return localStorage.getItem(paidKey(period)) === '1';
  } catch {
    return false;
  }
}
function writePaid(period: string) {
  try {
    localStorage.setItem(paidKey(period), '1');
  } catch {
    /* ignore */
  }
}
