'use client';

import { useState } from 'react';
import { Sparkles } from '@/components/icons';

const PRESETS = [100_000, 500_000, 1_000_000, 5_000_000];
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** "See how much you can save" — mirrors the self-signup savings reveal (~15%). */
export function SavingsCalculator() {
  const [spend, setSpend] = useState(1_000_000);
  const savings = Math.round(spend * 0.15);

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-brand/20 bg-white p-6 shadow-sm sm:p-10">
      <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
        <Sparkles className="h-4 w-4" /> Savings calculator
      </p>
      <h3 className="mt-3 text-center font-display text-2xl font-bold text-navy sm:text-3xl">
        See how much you can save
      </h3>
      <p className="mt-2 text-center text-sm text-slate-500">
        Enter your annual travel spend — companies like yours typically save ~15% with HeyVacay.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setSpend(p)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              spend === p
                ? 'bg-navy text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {money(p)}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-4 max-w-xs">
        <label className="mb-1.5 block text-center text-xs font-medium text-slate-500">
          Or enter a custom amount
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={spend ? spend.toLocaleString('en-US') : ''}
            onChange={(e) => setSpend(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="2,500,000"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pl-7 text-center text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-brand/8 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Estimated annual savings
        </p>
        <p className="mt-1 font-display text-4xl font-extrabold text-navy sm:text-5xl">
          {money(savings)}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          on {money(spend)} of annual travel — and HeyVacay stays free.
        </p>
      </div>

      <div className="mt-6 text-center">
        <a
          href="/signup"
          className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-navy-deep shadow-sm hover:brightness-95"
        >
          Start saving — it&apos;s free
        </a>
      </div>
    </div>
  );
}
