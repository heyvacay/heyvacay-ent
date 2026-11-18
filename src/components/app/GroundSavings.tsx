'use client';

import { useState } from 'react';
import { Car, CarTaxiFront, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/components/app/ui';
import { money } from '@/lib/format';
import {
  compareGround,
  GROUND_ASSUMPTIONS,
  GROUND_MODE_LABELS,
  GROUND_MODE_SUB,
  type GroundComparison,
  type GroundInput,
  type GroundMode,
} from '@/lib/rideshare';

const MODE_ORDER: GroundMode[] = ['any', 'rideshare', 'rental'];
const MODE_ICON: Record<GroundMode, React.ComponentType<{ className?: string }>> = {
  any: Sparkles,
  rideshare: CarTaxiFront,
  rental: Car,
};

/** Radio-style picker for the ground-transport policy (event or company). */
export function GroundModePicker({
  value,
  onChange,
  inheritLabel,
}: {
  value: GroundMode;
  onChange: (m: GroundMode) => void;
  /** When set, the 'any' option reads "Inherit / traveler decides". */
  inheritLabel?: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {MODE_ORDER.map((m) => {
        const Icon = MODE_ICON[m];
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={active}
            className={cn(
              'flex flex-col gap-1 rounded-xl border px-3 py-3 text-left transition',
              active
                ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5'
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-lg',
                  active ? 'bg-brand text-navy' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {m === 'any' && inheritLabel ? inheritLabel : GROUND_MODE_LABELS[m]}
              </span>
            </span>
            <span className="text-[11px] leading-snug text-slate-400">{GROUND_MODE_SUB[m]}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Side-by-side rideshare vs. rental-car cost estimate for a trip, with the
 * cheaper option flagged and an expandable line-item breakdown. Used in the
 * create-event wizard (policy preview) and in Plan a trip (traveler guidance).
 */
export function GroundSavings({
  days,
  ridesPerDay,
  parking = true,
  compact = false,
  className,
}: GroundInput & { compact?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const cmp = compareGround({ days, ridesPerDay, parking });

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-dark" />
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Rideshare vs. rental — estimated for this {days}-day trip
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OptionCard
          Icon={CarTaxiFront}
          title="Rideshare"
          sub="Uber / Lyft"
          total={cmp.rideshare.total}
          best={cmp.cheaper === 'rideshare'}
        />
        <OptionCard
          Icon={Car}
          title="Rental car"
          sub="All-in"
          total={cmp.rental.total}
          best={cmp.cheaper === 'rental'}
        />
      </div>

      <p
        className={cn(
          'mt-3 text-sm font-medium',
          cmp.savings > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'
        )}
      >
        {cmp.rationale}
      </p>

      {!compact && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline"
          >
            {open ? 'Hide' : 'Show'} the breakdown
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
          {open && <Breakdown cmp={cmp} ridesPerDay={ridesPerDay} />}
        </>
      )}
    </div>
  );
}

function OptionCard({
  Icon,
  title,
  sub,
  total,
  best,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  total: number;
  best: boolean;
}) {
  return (
    <div
      className={cn(
        'relative rounded-xl border p-3 transition',
        best
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
          : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5'
      )}
    >
      {best && (
        <span className="absolute right-2 top-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Cheaper
        </span>
      )}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'grid h-8 w-8 place-items-center rounded-lg',
            best ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-300'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-[11px] text-slate-400">{sub}</p>
        </div>
      </div>
      <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{money(total)}</p>
    </div>
  );
}

function Breakdown({ cmp, ridesPerDay }: { cmp: GroundComparison; ridesPerDay?: number }) {
  const rpd = ridesPerDay ?? GROUND_ASSUMPTIONS.defaultRidesPerDay;
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <LineList title="Rideshare" lines={cmp.rideshare.lines} total={cmp.rideshare.total} />
      <LineList title="Rental car" lines={cmp.rental.lines} total={cmp.rental.total} />
      <p className="col-span-full text-[11px] leading-relaxed text-slate-400">
        Estimates use US business-travel averages ({rpd} local rides/day, metro airport transfer,
        corporate rental rate incl. insurance, fuel &amp; parking). Live Uber for Business fares can
        replace these once the customer&apos;s enterprise contract is connected.
      </p>
    </div>
  );
}

function LineList({
  title,
  lines,
  total,
}: {
  title: string;
  lines: { label: string; amount: number }[];
  total: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={l.label} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
            <span className="pr-2">{l.label}</span>
            <span className="font-medium tabular-nums">{money(l.amount)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-slate-200 pt-1 text-xs font-bold text-slate-900 dark:border-white/10 dark:text-white">
          <span>Total</span>
          <span className="tabular-nums">{money(total)}</span>
        </li>
      </ul>
    </div>
  );
}
