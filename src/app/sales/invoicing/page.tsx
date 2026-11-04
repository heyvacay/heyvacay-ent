'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCrm } from '@/lib/crmStore';
import { Badge, Button, Card, Field, Input, PageHeader, cn } from '@/components/app/ui';
import { money, shortDate } from '@/lib/format';
import { Receipt, Shield, Check, Building } from '@/components/icons';
import type { AppState, KycStatus, Net30Kyc } from '@/lib/types';
import {
  readAccountState,
  crmSendKyc,
  crmSetKycStatus,
  crmInvoicePaid,
  crmRecordInvoicePaid,
} from '@/lib/crmInvoicing';
import { buildInvoices, type Invoice } from '@/lib/invoicing';

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
  address: '2100 Kramer Lane, Suite 300, Austin, TX 78758',
  bankName: 'Silicon Valley Bank',
  routing: '121140399',
  account: '•••• 4821',
  email: 'ar@heyvacay.co',
};

export default function CrmInvoicingPage() {
  const { companies, currentRep } = useCrm();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
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
        const outstanding = invoices
          .filter((inv) => !inv.reported)
          .reduce((s, inv) => s + inv.amountDue, 0);
        return { company: c, state: st, kyc, invoices, outstanding };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceCompanies, query, refresh, mounted]);

  const selected = rows.find((r) => r.company.id === selectedId) ?? rows[0] ?? null;

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
        subtitle="Net 30 companies, their KYC, and their invoices — search, review and generate, all from here."
      />

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
                onGenerate={setPrintInvoice}
                onPaidToggle={(period, paid) => {
                  crmRecordInvoicePaid(selected.company.id, period, paid);
                  bump();
                }}
              />
            </>
          )}
        </div>
      </div>

      {printInvoice && selected && (
        <PrintInvoiceModal
          invoice={printInvoice}
          companyName={selected.company.name}
          onClose={() => setPrintInvoice(null)}
        />
      )}
    </div>
  );
}

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

function InvoicesPanel({
  companyId,
  companyName,
  state,
  invoices,
  onGenerate,
  onPaidToggle,
}: {
  companyId: string;
  companyName: string;
  state: AppState | null;
  invoices: Invoice[];
  onGenerate: (inv: Invoice) => void;
  onPaidToggle: (period: string, paid: boolean) => void;
}) {
  const net30 = state?.billing?.netKyc?.status === 'approved';
  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
        <Receipt className="h-5 w-5 text-brand-dark" /> Invoices
      </h2>
      {!net30 ? (
        <p className="text-sm text-slate-500">
          Invoices appear here once {companyName}&apos;s Net 30 is approved. They&apos;re built from
          confirmed bookings, every 30 days.
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
                      <Button size="sm" variant="outline" onClick={() => onGenerate(inv)}>
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

function PrintInvoiceModal({
  invoice,
  companyName,
  onClose,
}: {
  invoice: Invoice;
  companyName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-xl font-bold text-slate-900">Invoice #{invoice.number}</p>
            <p className="text-xs text-slate-500">
              Issued {invoice.issued} · Due {invoice.due}
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p className="font-semibold text-slate-700">{REMIT.entity}</p>
            <p>{REMIT.address}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Bill to:</span> {companyName}
        </p>

        <table className="mt-4 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400">
              <th className="py-1.5 pr-2">Traveler</th>
              <th className="py-1.5 pr-2">Item</th>
              <th className="py-1.5 pr-2">Dates</th>
              <th className="py-1.5 pr-2 text-right">Base</th>
              <th className="py-1.5 pr-2 text-right">Tax</th>
              <th className="py-1.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.booking.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 font-medium text-slate-700">{l.travelerName}</td>
                <td className="py-1.5 pr-2 text-slate-500">
                  {l.booking.title}
                  {l.booking.roomType ? ` · ${l.booking.roomType}` : ''}
                </td>
                <td className="py-1.5 pr-2 text-slate-500">
                  {l.booking.startDate} → {l.booking.endDate}
                </td>
                <td className="py-1.5 pr-2 text-right">{money(l.base)}</td>
                <td className="py-1.5 pr-2 text-right">{money(l.tax)}</td>
                <td className="py-1.5 text-right font-medium">{money(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Subtotal</span>
            <span className="font-medium">{money(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Tax</span>
            <span className="font-medium">{money(invoice.tax)}</span>
          </div>
          {invoice.lateFee > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Late fee</span>
              <span className="font-medium">{money(invoice.lateFee)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1 font-display text-base font-bold">
            <span>Amount due</span>
            <span>{money(invoice.amountDue)}</span>
          </div>
        </div>

        <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-400">
          Net 10 terms. Remit to {REMIT.entity}, {REMIT.bankName} routing {REMIT.routing}, acct{' '}
          {REMIT.account}. Questions: {REMIT.email}.
        </p>

        <div className="mt-4 flex justify-end gap-2 print:hidden">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print / Save PDF</Button>
        </div>
      </div>
    </div>
  );
}
