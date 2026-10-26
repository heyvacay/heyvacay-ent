'use client';

import { useState } from 'react';
import { useCrm } from '@/lib/crmStore';
import { CONTRACT_TYPE_LABEL, PRICING_LABEL } from '@/lib/crm';
import { contractPdf } from '@/lib/pdf';
import { Sparkles, Check, Receipt } from '@/components/icons';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function SignContract({ id }: { id: string }) {
  const { companies, signContract } = useCrm();
  const [heyName, setHeyName] = useState('');
  const [custName, setCustName] = useState('');

  const found = companies
    .map((c) => ({ c, ct: c.contracts.find((x) => x.id === id) }))
    .find((x) => x.ct);

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

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
