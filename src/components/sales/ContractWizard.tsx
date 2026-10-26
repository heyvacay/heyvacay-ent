'use client';

import { useMemo, useState } from 'react';
import { Button, Field, Input, Select, cn } from '@/components/app/ui';
import { useCrm } from '@/lib/crmStore';
import { contractPdf } from '@/lib/pdf';
import { money, todayISO } from '@/lib/format';
import {
  CONTRACT_TYPE_LABEL,
  PRICING_LABEL,
  type ContractTerms,
  type ContractType,
  type PricingModel,
  type SalesCompany,
} from '@/lib/crm';
import { Check, Sparkles } from '@/components/icons';

const SUPPORT_TIERS = ['Standard', 'Priority', 'Dedicated'];
const PAYMENT_OPTIONS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Due on receipt'];

type Step = 0 | 1 | 2 | 3 | 4;
const STEP_TITLES = [
  'What are we signing?',
  'How are we pricing it?',
  'Term & commitment',
  'Legal & signature',
  'Review & generate',
];

export function ContractWizard({
  company,
  onClose,
}: {
  company: SalesCompany;
  onClose: () => void;
}) {
  const { addContract } = useCrm();
  const champion = company.contacts.find((c) => c.champion) ?? company.contacts[0];

  // Prefill from the account's most recent contract so repeat paperwork is
  // fast — the rep only changes what's different this time.
  const prev = company.contracts[0];

  const [step, setStep] = useState<Step>(0);
  const [value, setValue] = useState(prev?.value ?? company.annualSpend);
  const [terms, setTerms] = useState<ContractTerms>(
    prev
      ? { ...prev.terms, type: 'order', startDate: todayISO() }
      : {
          type: 'order',
          pricingModel: 'commission',
          commissionPct: 0,
          platformFee: 0,
          discountPct: 0,
          termMonths: 12,
          startDate: todayISO(),
          paymentTerms: 'Net 30',
          minimumSpend: 0,
          supportTier: company.tier === 'Enterprise' ? 'Dedicated' : 'Priority',
          autoRenew: true,
          governingLaw: 'State of Delaware, USA',
          signerName: champion?.name ?? '',
          signerTitle: champion?.title ?? '',
        }
  );

  const set = <K extends keyof ContractTerms>(k: K, v: ContractTerms[K]) =>
    setTerms((t) => ({ ...t, [k]: v }));

  const title = useMemo(() => CONTRACT_TYPE_LABEL[terms.type], [terms.type]);

  const generate = () => {
    const contract = addContract(company.id, { title, terms, value });
    contractPdf(company, contract);
    onClose();
  };

  const next = () => setStep((s) => Math.min(4, s + 1) as Step);
  const back = () => setStep((s) => Math.max(0, s - 1) as Step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/15">
                <Sparkles className="h-4 w-4 text-brand-dark" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">Contract generator</p>
                <p className="text-xs text-slate-400">{company.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
          {/* step dots */}
          <div className="mt-3 flex gap-1.5">
            {STEP_TITLES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  i <= step ? 'bg-brand' : 'bg-slate-200'
                )}
              />
            ))}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto px-5 py-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-dark">
            Step {step + 1} of 5
          </p>
          <h3 className="mb-4 font-display text-lg font-bold text-slate-900">
            {STEP_TITLES[step]}
          </h3>

          {step === 0 && (
            <div className="space-y-2">
              <p className="mb-2 text-sm text-slate-500">
                Pick the document you need. Nova drafts the right clauses for each.
              </p>
              {(Object.keys(CONTRACT_TYPE_LABEL) as ContractType[]).map((ct) => (
                <ChoiceRow
                  key={ct}
                  selected={terms.type === ct}
                  title={CONTRACT_TYPE_LABEL[ct]}
                  sub={CONTRACT_TYPE_HINT[ct]}
                  onClick={() => set('type', ct)}
                />
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                HeyVacay is free by default — we earn commission on bookings. Choose
                the model for this account.
              </p>
              <div className="space-y-2">
                {(Object.keys(PRICING_LABEL) as PricingModel[]).map((pm) => (
                  <ChoiceRow
                    key={pm}
                    selected={terms.pricingModel === pm}
                    title={PRICING_LABEL[pm]}
                    onClick={() => set('pricingModel', pm)}
                  />
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Commission %">
                  <Input
                    type="number"
                    value={terms.commissionPct}
                    onChange={(e) => set('commissionPct', Number(e.target.value))}
                  />
                </Field>
                <Field label="Platform fee /yr">
                  <Input
                    type="number"
                    value={terms.platformFee}
                    disabled={terms.pricingModel === 'commission'}
                    onChange={(e) => set('platformFee', Number(e.target.value))}
                  />
                </Field>
                <Field label="Customer discount %">
                  <Input
                    type="number"
                    value={terms.discountPct}
                    onChange={(e) => set('discountPct', Number(e.target.value))}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Term (months)">
                  <Input
                    type="number"
                    value={terms.termMonths}
                    onChange={(e) => set('termMonths', Number(e.target.value))}
                  />
                </Field>
                <Field label="Start date">
                  <Input
                    type="date"
                    value={terms.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                  />
                </Field>
                <Field label="Contract value (ACV)">
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                  />
                </Field>
                <Field label="Minimum annual spend">
                  <Input
                    type="number"
                    value={terms.minimumSpend}
                    onChange={(e) => set('minimumSpend', Number(e.target.value))}
                  />
                </Field>
                <Field label="Payment terms">
                  <Select
                    value={terms.paymentTerms}
                    onChange={(e) => set('paymentTerms', e.target.value)}
                  >
                    {PAYMENT_OPTIONS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Support tier">
                  <Select
                    value={terms.supportTier}
                    onChange={(e) => set('supportTier', e.target.value)}
                  >
                    {SUPPORT_TIERS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => set('autoRenew', !terms.autoRenew)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-slate-300"
              >
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-md',
                    terms.autoRenew ? 'bg-brand text-navy-deep' : 'bg-slate-100 text-slate-300'
                  )}
                >
                  <Check className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-slate-800">
                    Auto-renew at end of term
                  </span>
                  <span className="block text-xs text-slate-400">
                    Renews for successive like terms unless cancelled 30 days prior.
                  </span>
                </span>
              </button>
              <Field label="Governing law">
                <Input
                  value={terms.governingLaw}
                  onChange={(e) => set('governingLaw', e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Customer signer">
                  <Input
                    value={terms.signerName}
                    onChange={(e) => set('signerName', e.target.value)}
                    placeholder="Full name"
                  />
                </Field>
                <Field label="Signer title">
                  <Input
                    value={terms.signerTitle}
                    onChange={(e) => set('signerTitle', e.target.value)}
                    placeholder="e.g. VP Finance"
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Review the terms. Generating creates a draft on the account and
                downloads the signed-ready PDF.
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-display text-base font-bold text-slate-900">{title}</p>
                <p className="text-xs text-slate-400">{company.name}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ['Pricing', PRICING_LABEL[terms.pricingModel]],
                    ['Commission', `${terms.commissionPct}%`],
                    ['Platform fee', terms.platformFee > 0 ? `${money(terms.platformFee)}/yr` : 'None'],
                    ['Discount', terms.discountPct > 0 ? `${terms.discountPct}%` : 'None'],
                    ['Term', `${terms.termMonths} months`],
                    ['Start', terms.startDate],
                    ['ACV', money(value)],
                    ['Min spend', terms.minimumSpend > 0 ? money(terms.minimumSpend) : 'None'],
                    ['Payment', terms.paymentTerms],
                    ['Support', terms.supportTier],
                    ['Auto-renew', terms.autoRenew ? 'Yes' : 'No'],
                    ['Signer', terms.signerName || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-slate-400">{k}</dt>
                      <dd className="text-right font-medium text-slate-700">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <Button variant="ghost" onClick={step === 0 ? onClose : back}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < 4 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={generate}>Generate contract & PDF</Button>
          )}
        </div>
      </div>
    </div>
  );
}

const CONTRACT_TYPE_HINT: Record<ContractType, string> = {
  msa: 'Full master agreement — the umbrella terms.',
  order: 'Short order form under an existing MSA. Fastest to sign.',
  pilot: 'Time-boxed trial with a conversion path.',
  renewal: 'Extend an existing agreement.',
  amendment: 'Change terms on a live contract.',
};

function ChoiceRow({
  selected,
  title,
  sub,
  onClick,
}: {
  selected: boolean;
  title: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
        selected ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-slate-300'
      )}
    >
      <span
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
          selected ? 'border-brand bg-brand text-navy-deep' : 'border-slate-300'
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        {sub && <span className="block text-xs text-slate-400">{sub}</span>}
      </span>
    </button>
  );
}
