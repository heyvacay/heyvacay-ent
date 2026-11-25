'use client';

import { useEffect, useRef, useState } from 'react';
import { useCrm } from '@/lib/crmStore';
import { CONTRACT_TYPE_LABEL, PRICING_LABEL, type Contract, type SalesCompany } from '@/lib/crm';
import { contractPdf } from '@/lib/pdf';
import { Sparkles, Check, Receipt } from '@/components/icons';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Readable agreement clauses, derived from the terms (our own language). */
function clauses(c: SalesCompany, ct: Contract): { title: string; body: string }[] {
  const t = ct.terms;
  return [
    {
      title: '1. Commercial terms',
      body: `${PRICING_LABEL[t.pricingModel]}. Commission ${t.commissionPct}% of booking value${t.platformFee > 0 ? `, platform fee ${money(t.platformFee)}/yr` : ''}${t.discountPct > 0 ? `, ${t.discountPct}% customer discount` : ''}. Term ${t.termMonths} months from ${t.startDate}. Payment ${t.paymentTerms}. ${t.minimumSpend > 0 ? `Minimum annual spend ${money(t.minimumSpend)}.` : 'No minimum spend commitment.'}`,
    },
    {
      title: '2. Scope of services',
      body: 'HeyVacay provides Customer access to its corporate travel and expense platform — flight and hotel booking, policy controls, budgets, approvals, expense management, and savings rewards — sourcing inventory from its supply partners at negotiated rates passed through to Customer.',
    },
    {
      title: '3. Fees & payment',
      body: `Fees are exclusive of taxes. Invoiced amounts are due ${t.paymentTerms}; undisputed overdue amounts accrue interest at the lesser of 1.5%/month or the legal maximum, and HeyVacay may suspend on 10 days' notice of non-payment.`,
    },
    {
      title: '4. Term & termination',
      body: `${t.autoRenew ? 'Renews automatically for like terms unless either party gives 30 days’ notice.' : 'Does not auto-renew; renewal requires a new order.'} Either party may terminate for material breach uncured 30 days after notice.`,
    },
    {
      title: '5. Confidentiality & data',
      body: "Each party protects the other's non-public information with reasonable care and uses it only to perform this Agreement, for 3 years after disclosure. HeyVacay processes traveler data only to provide the services and under its Data Processing Addendum.",
    },
    {
      title: '6. Liability',
      body: 'Neither party is liable for indirect or consequential damages; aggregate liability is capped at fees paid in the preceding 12 months, except for payment, confidentiality, and indemnification obligations.',
    },
    {
      title: '7. Support & governing law',
      body: `Customer receives ${t.supportTier} support. This Agreement is governed by the laws of ${t.governingLaw}. It is the entire agreement and may be amended only in writing signed by both parties.`,
    },
  ];
}

export function SignContract({ id }: { id: string }) {
  const { companies, signContract } = useCrm();
  const [heyName, setHeyName] = useState('');
  const [custName, setCustName] = useState('');
  const downloadedRef = useRef(false);

  const found = companies
    .map((c) => ({ c, ct: c.contracts.find((x) => x.id === id) }))
    .find((x) => x.ct);

  // Once both parties have signed, save a PDF that includes both signatures.
  useEffect(() => {
    const ct = found?.ct;
    const co = found?.c;
    if (ct && co && ct.signatures?.heyvacay && ct.signatures?.customer && !downloadedRef.current) {
      downloadedRef.current = true;
      contractPdf(co, ct);
    }
  }, [found]);

  if (!found || !found.ct) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-5">
        <div className="text-center">
          <p className="font-display text-xl font-bold text-slate-900">Contract not found</p>
          <p className="mt-1 text-sm text-slate-500">
            This sign link may be invalid, or opened on a different device than it was created on.
          </p>
        </div>
      </div>
    );
  }

  const { c, ct } = found;
  const t = ct.terms;
  const sig = ct.signatures ?? {};
  const fullyExecuted = Boolean(sig.heyvacay && sig.customer);
  const estSavings = Math.round(c.annualSpend * 0.15);

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-2xl px-5">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
            <Sparkles className="h-4 w-4 text-brand-dark" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold text-slate-900">HeyVacay</p>
            <p className="text-[11px] font-semibold text-brand-dark">Enterprise · e-signature</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {fullyExecuted && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              <Check className="h-5 w-5" /> Fully executed — this agreement is signed by both parties.
            </div>
          )}

          <h1 className="font-display text-2xl font-bold text-slate-900">{ct.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Between <span className="font-medium text-slate-700">HeyVacay, Inc.</span> and{' '}
            <span className="font-medium text-slate-700">{c.name}</span>
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            {[
              ['Type', CONTRACT_TYPE_LABEL[t.type]],
              ['Pricing', PRICING_LABEL[t.pricingModel]],
              ['Term', `${t.termMonths} months`],
              ['Start', t.startDate],
              ['ACV', money(ct.value)],
              ['Est. savings', `${money(estSavings)} (~15%)`],
              ['Payment', t.paymentTerms],
              ['Support', t.supportTier],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-slate-400">{k}</dt>
                <dd className="text-right font-medium text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>

          <button
            onClick={() => contractPdf(c, ct)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-dark hover:underline"
          >
            <Receipt className="h-4 w-4" /> Download full agreement (PDF)
          </button>

          {/* the agreement, to read before signing */}
          <div className="mt-5 max-h-80 overflow-auto rounded-xl border border-slate-200 p-4">
            <p className="text-sm leading-relaxed text-slate-600">
              This {CONTRACT_TYPE_LABEL[t.type]} is entered into as of {t.startDate} by and between
              HeyVacay, Inc. and {c.name} (&quot;Customer&quot;).
            </p>
            <div className="mt-3 space-y-3">
              {clauses(c, ct).map((cl) => (
                <div key={cl.title}>
                  <p className="text-sm font-semibold text-slate-800">{cl.title}</p>
                  <p className="text-sm leading-relaxed text-slate-500">{cl.body}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sign below
          </p>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <SignBox
              label="HeyVacay, Inc."
              signed={sig.heyvacay}
              name={heyName}
              setName={setHeyName}
              onSign={() => heyName.trim() && signContract(id, 'heyvacay', heyName.trim())}
            />
            <SignBox
              label={c.name}
              signed={sig.customer}
              name={custName}
              setName={setCustName}
              onSign={() => custName.trim() && signContract(id, 'customer', custName.trim())}
            />
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            By typing your name and clicking Sign, you agree this constitutes your electronic
            signature on this agreement.
          </p>
        </div>
      </div>
    </div>
  );
}

function SignBox({
  label,
  signed,
  name,
  setName,
  onSign,
}: {
  label: string;
  signed?: { name: string; date: string };
  name: string;
  setName: (v: string) => void;
  onSign: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {signed ? (
        <div className="mt-2">
          <p className="font-display text-lg italic text-slate-800">{signed.name}</p>
          <p className="text-xs text-emerald-600">✓ Signed {signed.date}</p>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your full name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            onClick={onSign}
            disabled={!name.trim()}
            className="w-full rounded-lg bg-brand py-2 text-sm font-semibold text-navy-deep hover:brightness-95 disabled:opacity-50"
          >
            Sign
          </button>
        </div>
      )}
    </div>
  );
}
