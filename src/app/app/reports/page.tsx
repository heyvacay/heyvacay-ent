'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Card, PageHeader, StatCard } from '@/components/app/ui';
import { money, money2, num, pct } from '@/lib/format';

// Deeper brand cyan for data marks — validated for >=3:1 contrast on white,
// unlike the light brand token (#23e3ef) used for accents.
const INK = '#0e7490';
const TRACK = '#f1f5f9';

function VBars({
  data,
}: {
  data: { label: string; value: number; hint: string }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-56 gap-3">
      {data.map((d) => (
        <div
          key={d.label}
          className="flex h-full flex-1 flex-col items-center gap-2"
        >
          <span className="text-xs font-semibold text-slate-600">
            {money(d.value)}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              title={d.hint}
              className="w-full rounded-t-[4px] transition-all"
              style={{
                height: `${Math.max(2, (d.value / max) * 100)}%`,
                backgroundColor: INK,
              }}
            />
          </div>
          <span className="text-xs text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function HBars({
  data,
}: {
  data: { label: string; value: number; sub?: string; hint: string }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3.5">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-700">{d.label}</span>
            <span className="text-slate-500">
              {money(d.value)}
              {d.sub && <span className="ml-1 text-slate-300">{d.sub}</span>}
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: TRACK }}
            title={d.hint}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (d.value / max) * 100)}%`,
                backgroundColor: INK,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { state } = useStore();

  const spend6 = state.history.reduce((s, h) => s + h.spend, 0);
  const save6 = state.history.reduce((s, h) => s + h.savings, 0);
  const belowMkt = spend6 + save6 > 0 ? save6 / (spend6 + save6) : 0;
  const pointsIssued = state.points
    .filter((p) => p.delta > 0)
    .reduce((s, p) => s + p.delta, 0);
  const reconciled = state.expenses
    .filter((e) => e.synced)
    .reduce((s, e) => s + e.amount, 0);

  const savingsSeries = state.history.map((h) => ({
    label: h.month,
    value: h.savings,
    hint: `${h.month}: ${money(h.savings)} saved on ${money(h.spend)} spent`,
  }));

  const byDept = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of state.bookings) {
      if (b.status === 'cancelled') continue;
      map.set(b.department, (map.get(b.department) ?? 0) + b.price);
    }
    return Array.from(map.entries())
      .map(([label, value]) => {
        const budget = state.budgets.find(
          (x) => x.scope === 'department' && x.refId === label
        );
        return {
          label,
          value,
          sub: budget ? `/ ${money(budget.limit)}` : undefined,
          hint: `${label}: ${money(value)} committed`,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [state.bookings, state.budgets]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of state.expenses) {
      if (e.status === 'rejected') continue;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({
        label,
        value,
        hint: `${label}: ${money2(value)}`,
      }))
      .sort((a, b) => b.value - a.value);
  }, [state.expenses]);

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Where your travel dollars go — and what HeyVacay is saving you."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          accent
          label="Saved vs market"
          value={money(save6)}
          sub={`${pct(belowMkt)} below market · last 6 mo`}
        />
        <StatCard
          label="Travel spend"
          value={money(spend6)}
          sub="Last 6 months"
        />
        <StatCard
          label="Reward points issued"
          value={num(pointsIssued)}
          sub="To your team"
        />
        <StatCard
          label="Posted to accounting"
          value={money2(reconciled)}
          sub="Reconciled expenses"
        />
      </div>

      <Card className="mt-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Savings delivered
          </h2>
          <span className="text-sm text-slate-400">last 6 months</span>
        </div>
        <p className="mb-5 text-sm text-slate-400">
          Each month&apos;s below-market savings on your managed travel.
        </p>
        <VBars data={savingsSeries} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
            Spend by department
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            Committed travel spend against each budget.
          </p>
          {byDept.length ? (
            <HBars data={byDept} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              No bookings yet.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
            Expenses by category
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            Where out-of-pocket and card spend lands.
          </p>
          {byCategory.length ? (
            <HBars data={byCategory} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              No expenses yet.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
