'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCrm } from '@/lib/crmStore';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  StatCard,
  PageHeader,
  cn,
} from '@/components/app/ui';
import { money, money2, shortDate, todayISO, uid } from '@/lib/format';
import { Receipt, Shield, Check } from '@/components/icons';
import { Logo } from '@/components/app/Logo';
import type { AppState, KycStatus, Net30Kyc } from '@/lib/types';
import {
  readAccountState,
  crmSendKyc,
  crmSetKycStatus,
  crmInvoicePaid,
  crmRecordInvoicePaid,
} from '@/lib/crmInvoicing';
import { buildInvoices, type Invoice } from '@/lib/invoicing';
import {
  LINE_CATEGORIES,
  type LineCategory,
  type ManualInvoice,
  type ManualLineItem,
  computeTotals,
  lineAmount,
  listManualInvoices,
  nextManualNumber,
  saveManualInvoice,
  setManualInvoicePaid,
  deleteManualInvoice,
} from '@/lib/manualInvoices';

const KYC_LABEL: Record<KycStatus, string> = {
  sent: 'Sent',
  received: 'Received',
  in_review: 'In review',
  needs_attention: 'Needs attention',
  approved: 'Approved',
  denied: 'Denied',
};
const KYC_COLOR: Record<KycStatus, 'slate' | 'amber' | 'green' | 'red' | 'brand'> = {
  sent: 'slate',
  received: 'brand',
  in_review: 'amber',
  needs_attention: 'amber',
  approved: 'green',
  denied: 'red',
};

const REMIT = {
  entity: 'HeyVacay, Inc.',
  addressLines: ['2100 Kramer Lane, Suite 300', 'Austin, TX 78758', 'United States'],
  taxId: '88-1234567',
  phone: '+1 (512) 555-0142',
  email: 'ar@heyvacay.co',
  web: 'heyvacay.co',
  bankName: 'Silicon Valley Bank',
  routing: '121140399',
  account: '•••• 4821',
  swift: 'SVBKUS6S',
  payLink: 'pay.heyvacay.co',
};

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString().slice(0, 10);
}

/* --------------------------- unified printable shape --------------------------- */

interface PrintRow {
  category: string;
  description: string;
  detail?: string; // traveler / dates / qty×price note
  quantity: number;
  unitPrice: number;
  amount: number;
}
interface BillTo {
  name: string;
  attn?: string;
  email?: string;
  address?: string;
}
interface Printable {
  number: string;
  billTo: BillTo;
  issued: string;
  due: string;
  terms: string;
  poNumber?: string;
  status: 'paid' | 'open' | 'overdue';
  rows: PrintRow[];
  subtotal: number;
  discount: number; // absolute value of negative lines
  tax: number;
  taxRatePct?: number;
  lateFee?: number;
  total: number;
  notes?: string;
  preparedBy?: string;
  kind: 'period' | 'manual';
}

function bookingCategory(type?: string): string {
  if (type === 'hotel') return 'Hotel';
  if (type === 'flight') return 'Flight';
  if (type === 'car') return 'Car rental';
  if (type === 'train') return 'Rail';
  return 'Travel';
}

function periodToPrintable(inv: Invoice, billTo: BillTo): Printable {
  const rows: PrintRow[] = inv.lines.map((l) => ({
    category: bookingCategory(l.booking.type),
    description: `${l.booking.title}${l.booking.roomType ? ` · ${l.booking.roomType}` : ''}`,
    detail: `${l.travelerName}${l.department && l.department !== '—' ? ` · ${l.department}` : ''} · ${l.booking.startDate} → ${l.booking.endDate}${l.nights ? ` (${l.nights} night${l.nights === 1 ? '' : 's'})` : ''}`,
    quantity: 1,
    unitPrice: l.total,
    amount: l.total,
  }));
  return {
    number: `HV-${inv.number}`,
    billTo,
    issued: inv.issued,
    due: inv.due,
    terms: 'Net 10',
    status: inv.reported ? 'paid' : inv.weeksLate > 0 ? 'overdue' : 'open',
    rows,
    subtotal: inv.subtotal,
    discount: 0,
    tax: inv.tax,
    lateFee: inv.lateFee,
    total: inv.amountDue,
    kind: 'period',
  };
}

function manualToPrintable(inv: ManualInvoice, fallback: BillTo): Printable {
  const today = todayISO();
  const rows: PrintRow[] = inv.items.map((it) => ({
    category: it.category,
    description: it.description || it.category,
    detail: undefined,
    quantity: it.quantity,
    unitPrice: it.unitAmount,
    amount: lineAmount(it),
  }));
  const discount = inv.items.reduce((s, it) => {
    const amt = lineAmount(it);
    return amt < 0 ? s + amt : s;
  }, 0);
  const termDays = Math.max(
    0,
    Math.round((new Date(inv.due).getTime() - new Date(inv.issued).getTime()) / 86400000)
  );
  return {
    number: inv.number,
    billTo: { ...fallback, name: inv.billTo || fallback.name },
    issued: inv.issued,
    due: inv.due,
    terms: `Net ${termDays}`,
    poNumber: inv.poNumber,
    status: inv.paid ? 'paid' : inv.due < today ? 'overdue' : 'open',
    rows,
    subtotal: inv.subtotal,
    discount: Math.abs(discount),
    tax: inv.tax,
    taxRatePct: inv.taxRatePct,
    total: inv.total,
    notes: inv.notes,
    preparedBy: inv.createdBy,
    kind: 'manual',
  };
}

/* --------------------------------- page --------------------------------- */

export default function CrmInvoicingPage() {
  const { companies, currentRep } = useCrm();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [printing, setPrinting] = useState<Printable | null>(null);
  const [composing, setComposing] = useState(false);
  // Bump to re-read localStorage after a write.
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh((n) => n + 1);
  // localStorage reads must only run on the client (avoid hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Companies that have (or can have) a workspace — leads have none yet.
  const workspaceCompanies = useMemo(
    () => companies.filter((c) => c.status === 'onboarding' || c.status === 'active'),
    [companies]
  );

  const rows = useMemo(() => {
    if (!mounted) return [];
    const q = query.trim().toLowerCase();
    return workspaceCompanies
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q))
      .map((c) => {
        const st = readAccountState(c.id);
        const kyc = st?.billing?.netKyc ?? null;
        const invoices = st
          ? buildInvoices(st.bookings, {
              userName: (id) => st.users.find((u) => u.id === id)?.name ?? 'Traveler',
              isPaid: (period) => crmInvoicePaid(c.id, period),
            })
          : [];
        const manual = listManualInvoices(c.id);
        const periodOutstanding = invoices
          .filter((inv) => !inv.reported)
          .reduce((s, inv) => s + inv.amountDue, 0);
        const manualOutstanding = manual
          .filter((m) => !m.paid)
          .reduce((s, m) => s + m.total, 0);
        return {
          company: c,
          state: st,
          kyc,
          invoices,
          manual,
          outstanding: periodOutstanding + manualOutstanding,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceCompanies, query, refresh, mounted]);

  const selected = rows.find((r) => r.company.id === selectedId) ?? rows[0] ?? null;

  // Bill-to block for the selected company, enriched from approved KYC fields.
  const selBillTo: BillTo | null = selected
    ? (() => {
        const f = selected.state?.billing?.netKyc?.fields;
        return {
          name: f?.legalName || selected.company.name,
          email: f?.billingEmail || undefined,
          address: f?.billingAddress || undefined,
          attn: f?.signerName || undefined,
        };
      })()
    : null;

  // Portfolio-wide AR summary (Salesforce-style billing overview).
  const ar = useMemo(() => {
    const today = todayISO();
    let outstanding = 0;
    let overdue = 0;
    let collected = 0;
    let net30 = 0;
    for (const r of rows) {
      if (r.kyc?.status === 'approved') net30 += 1;
      for (const inv of r.invoices) {
        if (inv.reported) collected += inv.amountDue;
        else {
          outstanding += inv.amountDue;
          if (inv.weeksLate > 0) overdue += inv.amountDue;
        }
      }
      for (const m of r.manual) {
        if (m.paid) collected += m.total;
        else {
          outstanding += m.total;
          if (m.due < today) overdue += m.total;
        }
      }
    }
    return { outstanding, overdue, collected, net30 };
  }, [rows]);

  const sendKyc = () => {
    if (!selected) return;
    crmSendKyc(selected.company.id, { name: selected.company.name, domain: selected.company.domain }, currentRep);
    setSelectedId(selected.company.id);
    bump();
  };
  const setStatus = (status: KycStatus, comment?: string) => {
    if (!selected) return;
    crmSetKycStatus(selected.company.id, status, currentRep, comment);
    setReviewNote('');
    bump();
  };

  return (
    <div>
      <PageHeader
        title="Invoicing"
        subtitle="Net 30 companies, their KYC, and their invoices — search, review, generate custom invoices, all from here."
      />

      {/* AR summary */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outstanding" value={money(ar.outstanding)} sub="Open across all accounts" accent />
        <StatCard label="Overdue" value={money(ar.overdue)} sub="Past the due date" />
        <StatCard label="Collected" value={money(ar.collected)} sub="Marked paid" />
        <StatCard label="On Net 30" value={ar.net30} sub="Approved companies" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* company list */}
        <div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies…"
            className="mb-3"
          />
          <div className="space-y-1.5">
            {rows.length === 0 && (
              <Card>
                <p className="text-sm text-slate-500">No companies with a workspace yet.</p>
              </Card>
            )}
            {rows.map((r) => {
              const active = selected?.company.id === r.company.id;
              return (
                <button
                  key={r.company.id}
                  onClick={() => setSelectedId(r.company.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                    active
                      ? 'border-brand bg-brand/5'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5'
                  )}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-white/10">
                    {r.company.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.company.logoUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      r.company.name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {r.company.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {r.kyc ? (
                        <Badge color={KYC_COLOR[r.kyc.status]}>{KYC_LABEL[r.kyc.status]}</Badge>
                      ) : (
                        <span className="text-[11px] text-slate-400">No KYC</span>
                      )}
                      {r.outstanding > 0 && (
                        <span className="text-[11px] font-medium text-amber-600">
                          {money(r.outstanding)} due
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* detail */}
        <div className="space-y-6">
          {!selected ? (
            <Card>
              <p className="text-sm text-slate-500">Select a company to manage its Net 30 and invoices.</p>
            </Card>
          ) : (
            <>
              <KycPanel
                companyName={selected.company.name}
                kyc={selected.kyc}
                hasAccount={!!selected.state}
                reviewNote={reviewNote}
                setReviewNote={setReviewNote}
                onSend={sendKyc}
                onSetStatus={setStatus}
              />
              <InvoicesPanel
                companyId={selected.company.id}
                companyName={selected.company.name}
                state={selected.state}
                invoices={selected.invoices}
                manual={selected.manual}
                onNewInvoice={() => setComposing(true)}
                onGeneratePeriod={(inv) =>
                  selBillTo && setPrinting(periodToPrintable(inv, selBillTo))
                }
                onOpenManual={(m) => selBillTo && setPrinting(manualToPrintable(m, selBillTo))}
                onPaidToggle={(period, paid) => {
                  crmRecordInvoicePaid(selected.company.id, period, paid);
                  bump();
                }}
                onManualPaidToggle={(id, paid) => {
                  setManualInvoicePaid(selected.company.id, id, paid);
                  bump();
                }}
                onManualDelete={(id) => {
                  deleteManualInvoice(selected.company.id, id);
                  bump();
                }}
              />
            </>
          )}
        </div>
      </div>

      {composing && selected && (
        <InvoiceComposer
          companyId={selected.company.id}
          companyName={selected.company.name}
          billingEmail={selected.state?.billing?.netKyc?.fields?.billingEmail}
          periodInvoices={selected.invoices}
          createdBy={currentRep}
          onClose={() => setComposing(false)}
          onGenerated={(inv) => {
            setComposing(false);
            if (selBillTo) setPrinting(manualToPrintable(inv, selBillTo));
            bump();
          }}
        />
      )}

      {printing && <PrintInvoiceModal invoice={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}

/* --------------------------------- KYC panel (unchanged) --------------------------------- */

function KycPanel({
  companyName,
  kyc,
  hasAccount,
  reviewNote,
  setReviewNote,
  onSend,
  onSetStatus,
}: {
  companyName: string;
  kyc: Net30Kyc | null;
  hasAccount: boolean;
  reviewNote: string;
  setReviewNote: (v: string) => void;
  onSend: () => void;
  onSetStatus: (status: KycStatus, comment?: string) => void;
}) {
  const f = kyc?.fields;
  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
        <Shield className="h-5 w-5 text-brand-dark" /> Net 30 / KYC
        {kyc && <Badge color={KYC_COLOR[kyc.status]}>{KYC_LABEL[kyc.status]}</Badge>}
      </h2>

      {!kyc ? (
        <div>
          <p className="mb-3 text-sm text-slate-500">
            {companyName} isn&apos;t on Net 30 yet. Send the KYC application to the account owner —
            they complete it (or you can on their behalf inside the account), then review and approve
            it here.
          </p>
          <Button onClick={onSend}>
            <Shield className="h-4 w-4" /> Send KYC application
          </Button>
          {!hasAccount && (
            <p className="mt-2 text-xs text-slate-400">
              This provisions {companyName}&apos;s workspace if it doesn&apos;t exist yet.
            </p>
          )}
        </div>
      ) : kyc.status === 'sent' ? (
        <div className="rounded-xl bg-brand/5 p-3 text-sm text-slate-600 dark:text-slate-300">
          KYC sent to {kyc.ownerName} ({kyc.ownerEmail}) on {kyc.sentAt}. It shows here for review
          once submitted — or complete it on their behalf from inside the account (Billing → Net 30).
        </div>
      ) : kyc.status === 'approved' ? (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Check className="mr-1 inline h-4 w-4" /> Approved — Net 30 is active. Invoices below.
        </div>
      ) : kyc.status === 'denied' ? (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          Declined{kyc.reviewComment ? `: ${kyc.reviewComment}` : '.'} You can send a fresh KYC to
          restart.
        </div>
      ) : (
        /* received / in_review / needs_attention → reviewer workspace */
        <div className="space-y-3">
          {f && (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
              <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Submitted {kyc.submittedAt} by {kyc.ownerName}
              </p>
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {(
                  [
                    ['Legal entity', f.legalName],
                    ['Tax ID / EIN', f.taxId],
                    ['Owner SSN', f.ssn ? `•••-••-${f.ssn.replace(/\D/g, '').slice(-4)}` : '—'],
                    ['Billing email', f.billingEmail],
                    ['Billing address', f.billingAddress],
                    ['Signer', `${f.signerName}${f.signerTitle ? `, ${f.signerTitle}` : ''}`],
                    ['Signature', f.signatureName ? `✍ ${f.signatureName}` : '—'],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 text-xs">
                    <dt className="text-slate-400">{k}</dt>
                    <dd className="text-right font-medium text-slate-700 dark:text-slate-200">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {kyc.ownerResponse && (
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
              <span className="font-semibold">Owner reply:</span> {kyc.ownerResponse}
            </p>
          )}
          <Field label="Note to the account (required for “Needs attention”)">
            <Input
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. The SSN doesn’t match the signer — please re-check."
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {kyc.status !== 'in_review' && (
              <Button variant="outline" onClick={() => onSetStatus('in_review')}>
                Mark in review
              </Button>
            )}
            <Button
              variant="outline"
              disabled={!reviewNote.trim()}
              onClick={() => reviewNote.trim() && onSetStatus('needs_attention', reviewNote.trim())}
            >
              Needs attention
            </Button>
            <Button variant="outline" onClick={() => onSetStatus('denied', reviewNote.trim() || undefined)}>
              Deny
            </Button>
            <Button onClick={() => onSetStatus('approved')}>
              <Check className="h-4 w-4" /> Approve &amp; activate Net 30
            </Button>
          </div>
        </div>
      )}

      {kyc?.history && kyc.history.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-400">
            Review history ({kyc.history.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {kyc.history
              .slice()
              .reverse()
              .map((h, i) => (
                <li key={i} className="text-xs text-slate-500">
                  <span className="font-medium">{KYC_LABEL[h.status]}</span> · {h.by} · {h.at}
                  {h.comment ? ` — ${h.comment}` : ''}
                </li>
              ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

/* --------------------------------- invoices panel --------------------------------- */

function InvoicesPanel({
  companyName,
  state,
  invoices,
  manual,
  onNewInvoice,
  onGeneratePeriod,
  onOpenManual,
  onPaidToggle,
  onManualPaidToggle,
  onManualDelete,
}: {
  companyId: string;
  companyName: string;
  state: AppState | null;
  invoices: Invoice[];
  manual: ManualInvoice[];
  onNewInvoice: () => void;
  onGeneratePeriod: (inv: Invoice) => void;
  onOpenManual: (m: ManualInvoice) => void;
  onPaidToggle: (period: string, paid: boolean) => void;
  onManualPaidToggle: (id: string, paid: boolean) => void;
  onManualDelete: (id: string) => void;
}) {
  const net30 = state?.billing?.netKyc?.status === 'approved';
  const today = todayISO();
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
          <Receipt className="h-5 w-5 text-brand-dark" /> Invoices
        </h2>
        <Button size="sm" onClick={onNewInvoice}>
          + New invoice
        </Button>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Generate a custom invoice any time — even a $0 balance — with your own line items (airline or
        hotel incurred charges, support fees, and more). Auto invoices from confirmed bookings appear
        below once Net 30 is approved.
      </p>

      {/* Manually-generated invoices */}
      {manual.length > 0 && (
        <div className="mb-5">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Generated invoices
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-400 dark:border-white/10">
                  <th className="py-2 pr-2">Invoice</th>
                  <th className="py-2 pr-2">Issued</th>
                  <th className="py-2 pr-2">Due</th>
                  <th className="py-2 pr-2 text-right">Amount</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manual.map((m) => {
                  const overdue = !m.paid && m.due < today;
                  return (
                    <tr key={m.id} className="border-b border-slate-100 dark:border-white/5">
                      <td className="py-2 pr-2 font-medium text-slate-700 dark:text-slate-200">
                        {m.number}
                        <span className="block text-[11px] font-normal text-slate-400">
                          {m.items.length} item{m.items.length === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-slate-500">{shortDate(m.issued)}</td>
                      <td className="py-2 pr-2 text-slate-500">{shortDate(m.due)}</td>
                      <td className="py-2 pr-2 text-right font-medium">{money2(m.total)}</td>
                      <td className="py-2 pr-2">
                        {m.paid ? (
                          <Badge color="green">Paid</Badge>
                        ) : overdue ? (
                          <Badge color="red">Overdue</Badge>
                        ) : (
                          <Badge color="amber">Open</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => onOpenManual(m)}>
                            View / print
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onManualPaidToggle(m.id, !m.paid)}
                          >
                            {m.paid ? 'Unmark' : 'Mark paid'}
                          </Button>
                          <button
                            onClick={() => onManualDelete(m.id)}
                            className="px-1.5 text-sm text-slate-300 hover:text-red-500"
                            title="Delete invoice"
                            aria-label="Delete invoice"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Auto period invoices from bookings */}
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Booking invoices (auto, every 30 days)
      </p>
      {!net30 ? (
        <p className="text-sm text-slate-500">
          Automatic booking invoices appear here once {companyName}&apos;s Net 30 is approved. You can
          still generate a custom invoice above at any time.
        </p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-slate-500">
          No invoiced bookings yet — confirmed trips will be invoiced here every 30 days.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-400 dark:border-white/10">
                <th className="py-2 pr-2">Invoice</th>
                <th className="py-2 pr-2">Issued</th>
                <th className="py-2 pr-2">Due</th>
                <th className="py-2 pr-2 text-right">Amount</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.period} className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-2 pr-2 font-medium text-slate-700 dark:text-slate-200">
                    #{inv.number}
                  </td>
                  <td className="py-2 pr-2 text-slate-500">{shortDate(inv.issued)}</td>
                  <td className="py-2 pr-2 text-slate-500">{shortDate(inv.due)}</td>
                  <td className="py-2 pr-2 text-right font-medium">
                    {money(inv.amountDue)}
                    {inv.lateFee > 0 && (
                      <span className="block text-[11px] font-normal text-red-600">
                        incl. {money(inv.lateFee)} late
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {inv.reported ? (
                      <Badge color="green">Paid</Badge>
                    ) : inv.weeksLate > 0 ? (
                      <Badge color="red">{inv.weeksLate}w late</Badge>
                    ) : (
                      <Badge color="amber">Open</Badge>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => onGeneratePeriod(inv)}>
                        Generate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onPaidToggle(inv.period, !inv.reported)}
                      >
                        {inv.reported ? 'Unmark' : 'Mark paid'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* --------------------------- invoice composer (review page) --------------------------- */

function newLine(category: LineCategory = 'Support charges'): ManualLineItem {
  return { id: uid('li'), category, description: '', quantity: 1, unitAmount: 0 };
}

function InvoiceComposer({
  companyId,
  companyName,
  billingEmail,
  periodInvoices,
  createdBy,
  onClose,
  onGenerated,
}: {
  companyId: string;
  companyName: string;
  billingEmail?: string;
  periodInvoices: Invoice[];
  createdBy: string;
  onClose: () => void;
  onGenerated: (inv: ManualInvoice) => void;
}) {
  const today = todayISO();
  const [billTo, setBillTo] = useState(companyName);
  const [poNumber, setPoNumber] = useState('');
  const [issued, setIssued] = useState(today);
  const [due, setDue] = useState(addDays(today, 30));
  const [taxRatePct, setTaxRatePct] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ManualLineItem[]>([newLine()]);
  const [pullPeriod, setPullPeriod] = useState('');

  const totals = useMemo(() => computeTotals(items, taxRatePct), [items, taxRatePct]);

  const setItem = (id: string, patch: Partial<ManualLineItem>) =>
    setItems((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeItem = (id: string) => setItems((list) => list.filter((l) => l.id !== id));
  const addItem = () => setItems((list) => [...list, newLine()]);

  // Append a booking period's lines as editable items (tax-inclusive unit price).
  const pullBookings = (period: string) => {
    setPullPeriod('');
    if (!period) return;
    const inv = periodInvoices.find((i) => i.period === period);
    if (!inv) return;
    const lines: ManualLineItem[] = inv.lines.map((l) => ({
      id: uid('li'),
      category: 'Travel booking' as LineCategory,
      description: `${l.travelerName} — ${l.booking.title}${
        l.booking.roomType ? ` (${l.booking.roomType})` : ''
      }`,
      quantity: 1,
      unitAmount: l.total,
    }));
    setItems((list) => {
      // Drop a single empty default line if that's all there is.
      const base = list.length === 1 && !list[0].description && list[0].unitAmount === 0 ? [] : list;
      return [...base, ...lines];
    });
  };

  const canGenerate = items.length > 0 && billTo.trim().length > 0;

  const generate = () => {
    if (!canGenerate) return;
    const { subtotal, tax, total } = totals;
    const inv: ManualInvoice = {
      id: uid('minv'),
      companyId,
      number: nextManualNumber(companyId),
      billTo: billTo.trim(),
      issued,
      due,
      items: items.map((l) => ({
        ...l,
        quantity: Number(l.quantity) || 0,
        unitAmount: Number(l.unitAmount) || 0,
        description: l.description.trim(),
      })),
      taxRatePct: Number(taxRatePct) || 0,
      notes: notes.trim() || undefined,
      poNumber: poNumber.trim() || undefined,
      subtotal,
      tax,
      total,
      paid: false,
      createdBy,
      createdAt: new Date().toISOString(),
    };
    saveManualInvoice(inv);
    onGenerated(inv);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="my-4 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Review &amp; generate invoice
            </h2>
            <p className="text-sm text-slate-500">
              For <span className="font-medium text-slate-700 dark:text-slate-200">{companyName}</span>.
              Add any line items, review, then generate.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
            ✕
          </button>
        </div>

        {/* header fields */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bill to">
            <Input value={billTo} onChange={(e) => setBillTo(e.target.value)} placeholder="Company legal name" />
          </Field>
          <Field label="PO number (optional)">
            <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-4821" />
          </Field>
          <Field label="Issue date">
            <Input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        {billingEmail && (
          <p className="mt-2 text-xs text-slate-400">
            Billing contact on file: <span className="font-medium text-slate-500">{billingEmail}</span>
          </p>
        )}

        {/* line items */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Line items</p>
            {periodInvoices.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                Pull in bookings:
                <Select
                  value={pullPeriod}
                  onChange={(e) => pullBookings(e.target.value)}
                  className="w-auto py-1 text-xs"
                >
                  <option value="">Choose period…</option>
                  {periodInvoices.map((i) => (
                    <option key={i.period} value={i.period}>
                      {i.period} · {money(i.total)}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>

          <div className="space-y-2">
            {items.map((l) => (
              <div
                key={l.id}
                className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-[1.1fr_1.6fr_auto_auto_auto_auto] sm:items-center dark:border-white/10"
              >
                <Select
                  value={l.category}
                  onChange={(e) => setItem(l.id, { category: e.target.value as LineCategory })}
                  className="py-2 text-sm"
                >
                  {LINE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Input
                  value={l.description}
                  onChange={(e) => setItem(l.id, { description: e.target.value })}
                  placeholder="Description"
                  className="py-2"
                />
                <Input
                  type="number"
                  value={l.quantity}
                  onChange={(e) => setItem(l.id, { quantity: Number(e.target.value) })}
                  className="w-16 py-2 text-right"
                  title="Quantity"
                />
                <Input
                  type="number"
                  value={l.unitAmount}
                  onChange={(e) => setItem(l.id, { unitAmount: Number(e.target.value) })}
                  className="w-28 py-2 text-right"
                  title="Unit amount (USD)"
                />
                <span className="px-1 text-right text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
                  {money2(lineAmount(l))}
                </span>
                <button
                  onClick={() => removeItem(l.id)}
                  className="justify-self-end px-2 text-slate-300 hover:text-red-500"
                  title="Remove line"
                  aria-label="Remove line"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addItem}
            className="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:border-brand hover:text-brand-dark dark:border-white/15"
          >
            + Add line item
          </button>
        </div>

        {/* totals + notes */}
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Notes / terms (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Airline change fees for the Q3 roadshow. Net 30 terms."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
            />
          </Field>
          <div className="min-w-[14rem] space-y-1.5 self-end text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-medium tabular-nums">{money2(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-slate-400">
                Tax
                <Input
                  type="number"
                  value={taxRatePct}
                  onChange={(e) => setTaxRatePct(Number(e.target.value))}
                  className="w-16 py-1 text-right text-xs"
                  title="Tax rate %"
                />
                %
              </span>
              <span className="font-medium tabular-nums">{money2(totals.tax)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 font-display text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{money2(totals.total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={generate} disabled={!canGenerate}>
            <Receipt className="h-4 w-4" /> Generate invoice
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- print modal (unified) --------------------------- */

const STATUS_META: Record<Printable['status'], { label: string; cls: string }> = {
  paid: { label: 'PAID', cls: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  open: { label: 'BALANCE DUE', cls: 'border-amber-300 bg-amber-50 text-amber-700' },
  overdue: { label: 'PAST DUE', cls: 'border-red-300 bg-red-50 text-red-700' },
};

function longDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function PrintInvoiceModal({ invoice, onClose }: { invoice: Printable; onClose: () => void }) {
  const status = STATUS_META[invoice.status];
  const balance = invoice.status === 'paid' ? 0 : invoice.total;
  return (
    <div
      className="hv-print-overlay fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/60 p-4 sm:p-8"
      onClick={onClose}
    >
      {/* The sheet: forced white + dark ink so it reads as a real document in
          both light and dark app themes, and prints clean. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          color: '#0f172a',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
        className="hv-invoice-sheet relative my-2 w-full max-w-3xl rounded-2xl shadow-2xl"
      >
        <div className="px-8 py-9 sm:px-12 sm:py-11">
          {/* ---------- header ---------- */}
          <div className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-6">
            <div>
              <Logo imgClassName="h-9" />
              <div className="mt-4 text-[11px] leading-relaxed text-slate-500">
                <p className="text-sm font-bold text-slate-800">{REMIT.entity}</p>
                {REMIT.addressLines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
                <p className="mt-1">Tax ID {REMIT.taxId}</p>
                <p>
                  {REMIT.phone} · {REMIT.email}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl font-extrabold tracking-tight text-slate-900">INVOICE</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{invoice.number}</p>
              <span
                className={cn(
                  'mt-3 inline-block rounded-md border px-3 py-1 text-xs font-extrabold tracking-wide',
                  status.cls
                )}
              >
                {status.label}
              </span>
            </div>
          </div>

          {/* ---------- parties + meta ---------- */}
          <div className="mt-6 grid gap-6 sm:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Bill to</p>
              <p className="mt-1.5 text-base font-bold text-slate-900">{invoice.billTo.name}</p>
              {invoice.billTo.attn && (
                <p className="text-sm text-slate-600">Attn: {invoice.billTo.attn}</p>
              )}
              {invoice.billTo.address && (
                <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{invoice.billTo.address}</p>
              )}
              {invoice.billTo.email && <p className="mt-0.5 text-sm text-slate-600">{invoice.billTo.email}</p>}
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Invoice date</dt>
                  <dd className="font-semibold text-slate-700">{longDate(invoice.issued)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Due date</dt>
                  <dd className="font-semibold text-slate-700">{longDate(invoice.due)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Terms</dt>
                  <dd className="font-semibold text-slate-700">{invoice.terms}</dd>
                </div>
                {invoice.poNumber && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">PO number</dt>
                    <dd className="font-semibold text-slate-700">{invoice.poNumber}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Currency</dt>
                  <dd className="font-semibold text-slate-700">USD</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* ---------- amount due banner ---------- */}
          <div className="mt-6 flex items-center justify-between rounded-lg bg-slate-900 px-5 py-3 text-white">
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              {invoice.status === 'paid' ? 'Amount paid' : 'Amount due'}
            </span>
            <span className="font-display text-2xl font-extrabold tabular-nums">
              {money2(invoice.total)}
              {invoice.status !== 'paid' && (
                <span className="ml-2 align-middle text-xs font-medium text-slate-300">
                  by {longDate(invoice.due)}
                </span>
              )}
            </span>
          </div>

          {/* ---------- line items ---------- */}
          <table className="mt-7 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="w-8 px-2 py-2 text-center font-bold">#</th>
                <th className="px-2 py-2 font-bold">Description</th>
                <th className="w-24 px-2 py-2 font-bold">Category</th>
                <th className="w-12 px-2 py-2 text-right font-bold">Qty</th>
                <th className="w-28 px-2 py-2 text-right font-bold">Unit price</th>
                <th className="w-28 px-2 py-2 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.rows.map((r, i) => (
                <tr key={i} className={cn('align-top', i % 2 === 1 && 'bg-slate-50/70')}>
                  <td className="px-2 py-2.5 text-center text-xs text-slate-400">{i + 1}</td>
                  <td className="px-2 py-2.5">
                    <p className="font-semibold text-slate-800">{r.description}</p>
                    {r.detail && <p className="mt-0.5 text-xs text-slate-500">{r.detail}</p>}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="inline-block rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {r.category}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{r.quantity}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{money2(r.unitPrice)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                    {money2(r.amount)}
                  </td>
                </tr>
              ))}
              {invoice.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-sm text-slate-400">
                    No line items — $0.00 invoice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ---------- totals ---------- */}
          <div className="mt-5 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium tabular-nums text-slate-700">{money2(invoice.subtotal)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Discounts</span>
                  <span className="font-medium tabular-nums text-emerald-600">−{money2(invoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Tax{typeof invoice.taxRatePct === 'number' ? ` (${invoice.taxRatePct}%)` : ''}
                </span>
                <span className="font-medium tabular-nums text-slate-700">{money2(invoice.tax)}</span>
              </div>
              {invoice.lateFee ? (
                <div className="flex justify-between">
                  <span className="text-slate-500">Late fee</span>
                  <span className="font-medium tabular-nums text-red-600">{money2(invoice.lateFee)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t-2 border-slate-900 pt-2 font-display text-lg font-extrabold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">{money2(invoice.total)}</span>
              </div>
              {invoice.status === 'paid' ? (
                <div className="flex justify-between text-emerald-600">
                  <span className="font-semibold">Paid in full</span>
                  <span className="font-semibold tabular-nums">−{money2(invoice.total)}</span>
                </div>
              ) : (
                <div className="flex justify-between rounded-md bg-slate-100 px-2 py-1 font-bold text-slate-900">
                  <span>Balance due</span>
                  <span className="tabular-nums">{money2(balance)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ---------- payment instructions ---------- */}
          <div className="mt-8 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Payment instructions</p>
              <dl className="mt-2 space-y-1 text-xs text-slate-600">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Pay online</dt>
                  <dd className="font-medium text-slate-700">{REMIT.payLink}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Bank</dt>
                  <dd className="font-medium text-slate-700">{REMIT.bankName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">ACH routing</dt>
                  <dd className="font-medium tabular-nums text-slate-700">{REMIT.routing}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Account</dt>
                  <dd className="font-medium tabular-nums text-slate-700">{REMIT.account}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">SWIFT</dt>
                  <dd className="font-medium text-slate-700">{REMIT.swift}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Reference</dt>
                  <dd className="font-medium text-slate-700">{invoice.number}</dd>
                </div>
              </dl>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Notes &amp; terms</p>
              {invoice.notes && <p className="mt-2 text-xs text-slate-600">{invoice.notes}</p>}
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Payment due by {longDate(invoice.due)} ({invoice.terms}). A late fee of 3% per week
                applies to past-due balances. Please include invoice reference{' '}
                <span className="font-semibold text-slate-700">{invoice.number}</span> with your payment.
                Questions? Contact {REMIT.email}.
              </p>
            </div>
          </div>

          {/* ---------- footer ---------- */}
          <div className="mt-8 border-t border-slate-200 pt-4 text-center">
            <p className="font-display text-sm font-bold text-slate-700">Thank you for your business.</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {REMIT.entity} · {REMIT.web} · {REMIT.email}
              {invoice.preparedBy ? ` · Prepared by ${invoice.preparedBy}` : ''}
            </p>
          </div>
        </div>

        {/* action bar (not printed) */}
        <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-3 print:hidden">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print / Save PDF</Button>
        </div>
      </div>
    </div>
  );
}
