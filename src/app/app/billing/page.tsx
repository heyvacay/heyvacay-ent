'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, Field, Input, PageHeader, cn } from '@/components/app/ui';
import { Check, Wallet, Shield } from '@/components/icons';
import type { BillingMode, KycStatus, Net30Kyc, Net30KycFields } from '@/lib/types';

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

function KycBadge({ status }: { status: KycStatus }) {
  return <Badge color={KYC_COLOR[status]}>{KYC_LABEL[status]}</Badge>;
}

/** Read-only view of the KYC the account submitted, for the reviewer. */
function KycSummary({ kyc }: { kyc: Net30Kyc }) {
  const f = kyc.fields;
  if (!f) return null;
  const rows: [string, string][] = [
    ['Legal entity', f.legalName],
    ['Tax ID / EIN', f.taxId],
    ['Owner SSN', f.ssn ? `•••-••-${f.ssn.replace(/\D/g, '').slice(-4)}` : '—'],
    ['Billing email', f.billingEmail],
    ['Billing address', f.billingAddress],
    ['Est. monthly spend', f.estMonthlySpend || '—'],
    ['Signer', `${f.signerName}${f.signerTitle ? `, ${f.signerTitle}` : ''}`],
    ['Signature', f.signatureName ? `✍ ${f.signatureName}` : '—'],
  ];
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
        Submitted {kyc.submittedAt} by {kyc.ownerName}
      </p>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 text-xs">
            <dt className="text-slate-400">{k}</dt>
            <dd className="text-right font-medium text-slate-700 dark:text-slate-200">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const METHODS = ['Credit card', 'Debit card', 'Apple Pay'];

export default function BillingPage() {
  const {
    state,
    activeUser,
    viewingAs,
    setBillingMode,
    linkCard,
    requestNet30,
    startNet30Kyc,
    submitNet30Kyc,
    setKycStatus,
    respondKyc,
    setPersonalCard,
  } = useStore();
  const billing = state.billing ?? { mode: 'employee' as BillingMode };
  const [card, setCard] = useState({ brand: 'Visa', last4: '' });
  const [pcard, setPcard] = useState({ brand: 'Visa', last4: '' });
  const [reviewNote, setReviewNote] = useState('');
  const [ownerReply, setOwnerReply] = useState('');

  const linkedCard = billing.cardLast4;
  const personalCard = activeUser.personalCard;
  const kyc = billing.netKyc;
  const net30Approved = kyc?.status === 'approved';

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Billing & payments"
        subtitle="How your company pays for travel booked through HeyVacay."
      />

      {/* accepted methods */}
      <Card className="mb-6">
        <h2 className="mb-2 font-display text-lg font-bold text-slate-900">Accepted payment methods</h2>
        <p className="mb-3 text-sm text-slate-400">
          Available by default for every company. Net 30 terms are set up through a sales rep.
        </p>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              <Check className="h-3.5 w-3.5 text-brand-dark" /> {m}
            </span>
          ))}
        </div>
      </Card>

      {/* how bookings are paid */}
      <Card className="mb-6">
        <h2 className="mb-3 font-display text-lg font-bold text-slate-900">How bookings are paid</h2>
        <div className="space-y-2">
          <Option
            active={billing.mode === 'card'}
            title="Company card on file"
            sub="We save a card for the company and auto-charge it when a booking is made. Employees are never prompted to pay."
            onClick={() => setBillingMode('card')}
          />
          <Option
            active={billing.mode === 'employee'}
            title="Employee enters payment at booking"
            sub="Each traveler is prompted to enter payment when they book."
            onClick={() => setBillingMode('employee')}
          />
          <Option
            active={billing.mode === 'net30'}
            title="Net 30 (invoiced)"
            sub="We invoice the company; travelers are never prompted to pay. Set up by a sales rep after KYC approval — see below."
            onClick={() => net30Approved && setBillingMode('net30')}
            disabled={!net30Approved}
            disabledLabel="Needs KYC approval"
          />
        </div>

        {billing.mode === 'card' && (
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Wallet className="h-4 w-4 text-brand-dark" /> Company card
            </p>
            {linkedCard ? (
              <p className="text-sm text-slate-600">
                {billing.cardBrand} •••• {linkedCard} on file.{' '}
                <button
                  onClick={() => linkCard('', '')}
                  className="text-xs font-medium text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={card.brand} onChange={(e) => setCard({ ...card, brand: e.target.value })} placeholder="Visa" />
                <Input
                  value={card.last4}
                  onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, '') })}
                  placeholder="Card number"
                  inputMode="numeric"
                />
                <Button onClick={() => card.last4.length >= 4 && linkCard(card.brand, card.last4.slice(-4))}>
                  Link card
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">Demo only — stored locally, never charged.</p>
          </div>
        )}
      </Card>

      {/* personal card */}
      <Card>
        <h2 className="mb-1 font-display text-lg font-bold text-slate-900">Your personal card</h2>
        <p className="mb-3 text-sm text-slate-500">
          Save a personal card to pay for a trip yourself and get reimbursed — it pre-fills at
          checkout and the charge is added to your expenses automatically.
        </p>
        {personalCard ? (
          <p className="text-sm text-slate-600">
            {personalCard.brand} •••• {personalCard.last4} on file.{' '}
            <button
              onClick={() => setPersonalCard(activeUser.id, '', '')}
              className="text-xs font-medium text-slate-400 hover:text-red-600"
            >
              Remove
            </button>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input value={pcard.brand} onChange={(e) => setPcard({ ...pcard, brand: e.target.value })} placeholder="Visa" />
            <Input
              value={pcard.last4}
              onChange={(e) => setPcard({ ...pcard, last4: e.target.value.replace(/\D/g, '') })}
              placeholder="Card number"
              inputMode="numeric"
            />
            <Button
              onClick={() =>
                pcard.last4.length >= 4 &&
                setPersonalCard(activeUser.id, pcard.brand || 'CARD', pcard.last4.slice(-4))
              }
            >
              Save card
            </Button>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">Demo only — stored locally, never charged.</p>
      </Card>

      {/* net 30 */}
      <Card className="mt-6">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
          <Shield className="h-5 w-5 text-brand-dark" /> Net 30 invoicing
        </h2>

        {/* Status chip + audit trail, shown once a KYC exists */}
        {kyc && kyc.status !== 'sent' && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <KycBadge status={kyc.status} />
            {kyc.reviewer && kyc.status !== 'received' && (
              <span className="text-xs text-slate-400">reviewed by {kyc.reviewer}</span>
            )}
          </div>
        )}

        {net30Approved ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" /> KYC approved — Net 30 is active.
              </p>
              {kyc?.fields && (
                <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  Invoices go to {kyc.fields.billingEmail || kyc.ownerEmail} · signed by{' '}
                  {kyc.fields.signerName}
                  {kyc.fields.signerTitle ? `, ${kyc.fields.signerTitle}` : ''}.
                </p>
              )}
            </div>
            <Link
              href="/app/invoices"
              className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-semibold text-brand-dark hover:bg-brand/10"
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Open your Invoice Center
              </span>
              <span>→</span>
            </Link>
          </div>
        ) : viewingAs ? (
          // HeyVacay rep viewing the account from Nova — start KYC and review it.
          !kyc || kyc.status === 'sent' ? (
            !kyc ? (
              <>
                <p className="mb-3 text-sm text-slate-500">
                  As the rep on this account, you can turn on Net 30. We&apos;ll send a KYC form to
                  the account owner; once they submit it, you review and approve it here.
                </p>
                <Button onClick={startNet30Kyc}>
                  <Shield className="h-4 w-4" /> Set up Net 30 — send KYC to account owner
                </Button>
              </>
            ) : (
              <div className="rounded-xl bg-brand/5 p-3 text-sm text-slate-600 dark:text-slate-300">
                KYC form sent to {kyc.ownerName} ({kyc.ownerEmail}) on {kyc.sentAt}. You&apos;ll
                review it here once they submit.
              </div>
            )
          ) : (
            // Reviewer workspace: see what they submitted + move the status.
            <div className="space-y-3">
              {kyc.fields && <KycSummary kyc={kyc} />}
              {kyc.ownerResponse && (
                <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <span className="font-semibold">Owner reply:</span> {kyc.ownerResponse}
                </p>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Note to the account (required for “Needs attention”)
                </label>
                <Input
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. The SSN doesn’t match the signer — please re-check."
                  className="mt-1"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {kyc.status !== 'in_review' && (
                  <Button variant="outline" onClick={() => setKycStatus('in_review')}>
                    Mark in review
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => reviewNote.trim() && setKycStatus('needs_attention', reviewNote.trim())}
                  disabled={!reviewNote.trim()}
                >
                  Needs attention
                </Button>
                <Button variant="outline" onClick={() => setKycStatus('denied', reviewNote.trim() || undefined)}>
                  Deny
                </Button>
                <Button onClick={() => setKycStatus('approved')}>
                  <Check className="h-4 w-4" /> Approve &amp; activate Net 30
                </Button>
              </div>
            </div>
          )
        ) : kyc?.status === 'sent' ? (
          // Account owner — fill in the KYC form.
          <KycForm
            ownerName={kyc.ownerName}
            rep={kyc.rep}
            onSubmit={submitNet30Kyc}
            defaults={{
              legalName: state.company.name,
              billingEmail: kyc.ownerEmail,
              signerName: activeUser.name,
              signerTitle: activeUser.title,
            }}
          />
        ) : kyc?.status === 'needs_attention' ? (
          // Owner must respond to the reviewer's note.
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="font-semibold">Your KYC needs attention.</p>
              <p className="mt-1">{kyc.reviewComment}</p>
            </div>
            <Input
              value={ownerReply}
              onChange={(e) => setOwnerReply(e.target.value)}
              placeholder="Reply to the HeyVacay team…"
            />
            <Button
              onClick={() => {
                if (ownerReply.trim()) {
                  respondKyc(ownerReply.trim());
                  setOwnerReply('');
                }
              }}
              disabled={!ownerReply.trim()}
            >
              Send reply
            </Button>
          </div>
        ) : kyc?.status === 'received' || kyc?.status === 'in_review' ? (
          <div className="rounded-xl bg-brand/5 p-3 text-sm text-slate-600 dark:text-slate-300">
            Thanks — your KYC is with the HeyVacay team for review. We&apos;ll email you the moment
            Net 30 is approved and your Invoice Center opens.
          </div>
        ) : kyc?.status === 'denied' ? (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            Your Net 30 application was declined{kyc.reviewComment ? `: ${kyc.reviewComment}` : '.'}{' '}
            Contact your account manager to discuss options.
          </div>
        ) : billing.netRequested ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Check className="h-4 w-4" /> Request received — your sales rep will set up Net 30 and
            send a KYC form to the account owner.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">
              Net 30 is set up by your sales rep and requires a quick KYC form from the account
              owner. Request it below and your account manager will start the process.
            </p>
            <Button onClick={requestNet30}>
              <Shield className="h-4 w-4" /> Request Net 30 — have a rep set it up
            </Button>
          </>
        )}

        {/* Audit trail */}
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
    </div>
  );
}

function KycForm({
  ownerName,
  rep,
  onSubmit,
  defaults,
}: {
  ownerName: string;
  rep: string;
  onSubmit: (f: Net30KycFields) => void;
  defaults: Partial<Net30KycFields>;
}) {
  const [f, setF] = useState<Net30KycFields>({
    legalName: defaults.legalName ?? '',
    taxId: '',
    ssn: '',
    billingEmail: defaults.billingEmail ?? '',
    billingAddress: '',
    estMonthlySpend: '',
    signerName: defaults.signerName ?? '',
    signerTitle: defaults.signerTitle ?? '',
    signatureName: '',
  });
  const set = (k: keyof Net30KycFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const signed =
    f.signatureName.trim().length > 1 &&
    f.signatureName.trim().toLowerCase() === f.signerName.trim().toLowerCase();
  const ready =
    f.legalName.trim() &&
    f.taxId.trim() &&
    f.ssn.replace(/\D/g, '').length === 9 &&
    f.billingEmail.trim() &&
    f.billingAddress.trim() &&
    f.signerName.trim() &&
    signed;

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Hi {ownerName} — {rep} started Net 30 setup. Complete this KYC (Know Your Customer) form.
        It&apos;s reviewed and approved by the HeyVacay team before invoiced billing turns on.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Legal entity name">
          <Input value={f.legalName} onChange={set('legalName')} placeholder="Acme, Inc." />
        </Field>
        <Field label="Tax ID / EIN">
          <Input value={f.taxId} onChange={set('taxId')} placeholder="12-3456789" />
        </Field>
        <Field label="Owner / guarantor SSN">
          <Input
            value={f.ssn}
            onChange={(e) => setF((p) => ({ ...p, ssn: ssnMask(e.target.value) }))}
            placeholder="123-45-6789"
            inputMode="numeric"
          />
        </Field>
        <Field label="Est. monthly travel spend">
          <Input value={f.estMonthlySpend} onChange={set('estMonthlySpend')} placeholder="$25,000" />
        </Field>
        <Field label="Billing email">
          <Input value={f.billingEmail} onChange={set('billingEmail')} placeholder="ap@acme.com" />
        </Field>
        <Field label="Est. monthly spend currency">
          <Input value="USD" disabled onChange={() => {}} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Billing address">
            <Input
              value={f.billingAddress}
              onChange={set('billingAddress')}
              placeholder="500 Main St, Austin, TX 78701"
            />
          </Field>
        </div>
        <Field label="Authorized signer">
          <Input value={f.signerName} onChange={set('signerName')} placeholder="Full name" />
        </Field>
        <Field label="Signer title">
          <Input value={f.signerTitle} onChange={set('signerTitle')} placeholder="CFO" />
        </Field>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Signature — type your full legal name exactly as the authorized signer to sign this
          agreement and personal guarantee.
        </p>
        <Input
          value={f.signatureName}
          onChange={set('signatureName')}
          placeholder={f.signerName || 'Type your full legal name'}
          className="mt-2 font-[cursive] text-lg"
        />
        {f.signatureName.trim() && !signed && (
          <p className="mt-1 text-xs text-amber-600">
            Signature must match the authorized signer name exactly.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={() => ready && onSubmit({ ...f, signedAt: new Date().toISOString() })}
          disabled={!ready}
        >
          <Shield className="h-4 w-4" /> Submit KYC for review
        </Button>
        <span className="text-xs text-slate-400">
          Submitting sends this to the HeyVacay team to review and approve.
        </span>
      </div>
    </div>
  );
}

/** Progressive SSN mask: 123-45-6789. */
function ssnMask(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 9);
  if (d.length < 4) return d;
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function Option({
  active,
  title,
  sub,
  onClick,
  disabled,
  disabledLabel = 'Needs sales approval',
}: {
  active: boolean;
  title: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
        active ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-slate-300',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border', active ? 'border-brand bg-brand text-navy-deep' : 'border-slate-300')}>
        {active && <Check className="h-3 w-3" />}
      </span>
      <span>
        <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
          {title}
          {disabled && <Badge color="slate">{disabledLabel}</Badge>}
        </span>
        <span className="mt-0.5 block text-xs text-slate-400">{sub}</span>
      </span>
    </button>
  );
}
