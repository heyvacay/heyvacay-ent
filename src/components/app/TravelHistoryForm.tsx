'use client';

import { Field, Input, cn } from '@/components/app/ui';
import { TRAVEL_CATEGORIES, type TravelHistory } from '@/lib/travelHistory';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * Optional "how did last year's travel look?" form. Controlled: the parent
 * owns `value` and gets updates via `onChange`. `details`/`onToggleDetails`
 * drive the per-quarter breakdown so the parent can persist the open state.
 */
export function TravelHistoryForm({
  value,
  onChange,
  details,
  onToggleDetails,
  compact = false,
}: {
  value: TravelHistory;
  onChange: (v: TravelHistory) => void;
  details: boolean;
  onToggleDetails: (open: boolean) => void;
  /** Tighter spacing for the CRM modal. */
  compact?: boolean;
}) {
  const quarters = value.quarters ?? QUARTERS.map((label) => ({ label, spend: 0 }));
  const setQuarter = (i: number, spend: number) => {
    const next = quarters.map((q, idx) => (idx === i ? { ...q, spend } : q));
    onChange({ ...value, quarters: next });
  };
  const quartersSum = quarters.reduce((s, q) => s + (q.spend || 0), 0);

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      <Field label="About how much did you spend on travel last year?">
        <div className="relative max-w-xs">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            $
          </span>
          <Input
            type="text"
            inputMode="numeric"
            className="pl-7"
            placeholder="e.g. 500,000"
            value={value.lastYearSpend ? value.lastYearSpend.toLocaleString('en-US') : ''}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^0-9]/g, ''));
              onChange({ ...value, lastYearSpend: Number.isFinite(n) ? n : 0 });
            }}
          />
        </div>
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
          Where did most of it go? <span className="font-normal text-slate-400">(if you know)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {TRAVEL_CATEGORIES.map((c) => {
            const on = value.dominantCategory === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onChange({ ...value, dominantCategory: on ? undefined : c.key })}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  on
                    ? 'bg-brand text-navy-deep'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10'
                )}
              >
                <span aria-hidden>{c.icon}</span> {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggleDetails(!details)}
        className="text-sm font-semibold text-brand-dark hover:underline"
      >
        {details ? '− Hide quarter-by-quarter' : '+ Give more details to help us optimize'}
      </button>

      {details && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
          <p className="mb-2 text-xs text-slate-500">
            Roughly what did you spend each quarter? This helps us plan around your busy seasons.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quarters.map((q, i) => (
              <Field key={q.label} label={q.label}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    $
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    className="pl-6"
                    placeholder="0"
                    value={q.spend ? q.spend.toLocaleString('en-US') : ''}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^0-9]/g, ''));
                      setQuarter(i, Number.isFinite(n) ? n : 0);
                    }}
                  />
                </div>
              </Field>
            ))}
          </div>
          {quartersSum > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Quarter total{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                ${quartersSum.toLocaleString('en-US')}
              </span>
              {value.lastYearSpend ? ` · last-year total $${value.lastYearSpend.toLocaleString('en-US')}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
