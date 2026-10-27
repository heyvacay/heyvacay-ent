'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Button, Card, PageHeader, StatCard, cn } from '@/components/app/ui';
import { money, money2, num, pct, shortDate, dateRange } from '@/lib/format';

// Deeper brand cyan for data marks — validated for >=3:1 contrast on white,
// unlike the light brand token (#23e3ef) used for accents.
const INK = '#0e7490';
const TRACK = '#f1f5f9';

type Level = 'company' | 'department' | 'employee' | 'transactions';
const LEVELS: { value: Level; label: string }[] = [
  { value: 'company', label: 'Company' },
  { value: 'department', label: 'Department' },
  { value: 'employee', label: 'Employee' },
  { value: 'transactions', label: 'Transactions' },
];

/* ---------------- CSV export ---------------- */

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- charts ---------------- */

function VBars({
  data,
}: {
  data: { label: string; value: number; hint: string }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-56 gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">{money(d.value)}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              title={d.hint}
              className="w-full rounded-t-[4px] transition-all"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: INK }}
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
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: INK }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function ReportsPage() {
  const { state, userById } = useStore();
  const [level, setLevel] = useState<Level>('company');

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

  const liveBookings = useMemo(
    () => state.bookings.filter((b) => b.status !== 'cancelled'),
    [state.bookings]
  );

  const byDept = useMemo(() => {
    const map = new Map<string, { spend: number; savings: number; trips: number }>();
    for (const b of liveBookings) {
      const cur = map.get(b.department) ?? { spend: 0, savings: 0, trips: 0 };
      cur.spend += b.price;
      cur.savings += b.savings;
      cur.trips += 1;
      map.set(b.department, cur);
    }
    return Array.from(map.entries())
      .map(([label, v]) => {
        const budget = state.budgets.find(
          (x) => x.scope === 'department' && x.refId === label
        );
        return {
          label,
          ...v,
          budget: budget?.limit,
          sub: budget ? `/ ${money(budget.limit)}` : undefined,
          hint: `${label}: ${money(v.spend)} committed`,
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [liveBookings, state.budgets]);

  const byEmployee = useMemo(() => {
    const map = new Map<
      string,
      { name: string; dept: string; spend: number; savings: number; trips: number }
    >();
    for (const b of liveBookings) {
      const u = userById(b.travelerId);
      const cur =
        map.get(b.travelerId) ?? {
          name: u?.name ?? 'Unknown',
          dept: b.department,
          spend: 0,
          savings: 0,
          trips: 0,
        };
      cur.spend += b.price;
      cur.savings += b.savings;
      cur.trips += 1;
      map.set(b.travelerId, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.spend - a.spend);
  }, [liveBookings, userById]);

  // Average spend across employees who actually travelled, and the outliers
  // who sit well above it — the "biggest spenders" alert.
  const avgSpend = byEmployee.length
    ? byEmployee.reduce((s, e) => s + e.spend, 0) / byEmployee.length
    : 0;
  const OUTLIER_FACTOR = 1.25; // 25%+ over the average flags an employee
  const outliers = byEmployee
    .filter((e) => avgSpend > 0 && e.spend > avgSpend * OUTLIER_FACTOR)
    .map((e) => ({ ...e, over: e.spend - avgSpend, overPct: (e.spend - avgSpend) / avgSpend }));

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of state.expenses) {
      if (e.status === 'rejected') continue;
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value, hint: `${label}: ${money2(value)}` }))
      .sort((a, b) => b.value - a.value);
  }, [state.expenses]);

  /* ----- raw dumps ----- */
  const exportBookings = () => {
    const headers = [
      'Employee',
      'Email',
      'Department',
      'Type',
      'Description',
      'Destination',
      'Airline / Room',
      'Start',
      'End',
      'Event',
      'Booked by',
      'Market price',
      'Price',
      'Savings',
      'Points',
      'Status',
      'Booked on',
    ];
    const rows = state.bookings.map((b) => {
      const trav = userById(b.travelerId);
      const booker = userById(b.bookedById);
      return [
        trav?.name ?? b.travelerId,
        trav?.email ?? '',
        b.department,
        b.type,
        b.title,
        b.destination ?? '',
        b.type === 'flight' ? b.airline ?? '' : b.roomType ?? '',
        b.startDate,
        b.endDate,
        b.eventName ?? '',
        booker?.name ?? '',
        b.marketPrice,
        b.price,
        b.savings,
        b.pointsEarned,
        b.status,
        b.createdAt,
      ];
    });
    downloadCsv(
      `heyvacay-bookings-${state.company.name.replace(/\s+/g, '-').toLowerCase()}.csv`,
      toCsv(headers, rows)
    );
  };

  const exportExpenses = () => {
    const headers = [
      'Employee',
      'Email',
      'Merchant',
      'Category',
      'Amount',
      'Date',
      'Status',
      'Receipt',
      'GL code',
      'Synced',
      'Note',
    ];
    const rows = state.expenses.map((e) => {
      const u = userById(e.userId);
      return [
        u?.name ?? e.userId,
        u?.email ?? '',
        e.merchant,
        e.category,
        e.amount,
        e.date,
        e.status,
        e.hasReceipt ? 'yes' : 'no',
        e.glCode ?? '',
        e.synced ? 'yes' : 'no',
        e.note ?? '',
      ];
    });
    downloadCsv(
      `heyvacay-expenses-${state.company.name.replace(/\s+/g, '-').toLowerCase()}.csv`,
      toCsv(headers, rows)
    );
  };

  const txns = useMemo(
    () => [...state.bookings].sort((a, b) => (a.startDate < b.startDate ? 1 : -1)),
    [state.bookings]
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Drill from the whole company down to a single trip — and pull the raw data anytime."
        actions={
          <Button variant="outline" size="sm" onClick={exportBookings}>
            ↓ Export bookings (CSV)
          </Button>
        }
      />

      {/* level switcher */}
      <div className="mb-6 inline-flex flex-wrap rounded-full bg-slate-100 p-1 text-sm">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            onClick={() => setLevel(l.value)}
            className={cn(
              'rounded-full px-4 py-1.5 font-semibold transition-colors',
              level === l.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* biggest-spender alert — surfaced on company & employee levels */}
      {(level === 'company' || level === 'employee') && outliers.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
              ⚠
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-bold text-slate-900">
                {outliers.length} {outliers.length === 1 ? 'employee is' : 'employees are'} well
                above the average
              </h2>
              <p className="text-sm text-slate-500">
                Average travel spend is {money(avgSpend)} per traveller. These are your biggest
                spenders:
              </p>
              <div className="mt-3 space-y-1.5">
                {outliers.slice(0, 5).map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-amber-100"
                  >
                    <span className="font-medium text-slate-800">
                      {e.name} <span className="text-slate-400">· {e.dept}</span>
                    </span>
                    <span className="text-slate-600">
                      {money(e.spend)}{' '}
                      <span className="font-semibold text-amber-700">
                        +{money(e.over)} ({pct(e.overPct)} over avg)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ---------------- Company ---------------- */}
      {level === 'company' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              accent
              label="Saved vs market"
              value={money(save6)}
              sub={`${pct(belowMkt)} below market · last 6 mo`}
            />
            <StatCard label="Travel spend" value={money(spend6)} sub="Last 6 months" />
            <StatCard label="Reward points issued" value={num(pointsIssued)} sub="To your team" />
            <StatCard label="Posted to accounting" value={money2(reconciled)} sub="Reconciled expenses" />
          </div>

          <Card className="mt-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Savings delivered</h2>
              <span className="text-sm text-slate-400">last 6 months</span>
            </div>
            <p className="mb-5 text-sm text-slate-400">
              Each month&apos;s below-market savings on your managed travel.
            </p>
            <VBars data={savingsSeries} />
          </Card>

          <Card className="mt-6">
            <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
              Expenses by category
            </h2>
            <p className="mb-5 text-sm text-slate-400">Where out-of-pocket and card spend lands.</p>
            {byCategory.length ? (
              <HBars data={byCategory} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">No expenses yet.</p>
            )}
          </Card>
        </>
      )}

      {/* ---------------- Department ---------------- */}
      {level === 'department' && (
        <Card>
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900">Spend by department</h2>
          <p className="mb-5 text-sm text-slate-400">Committed travel spend against each budget.</p>
          {byDept.length ? (
            <>
              <HBars
                data={byDept.map((d) => ({
                  label: d.label,
                  value: d.spend,
                  sub: d.sub,
                  hint: d.hint,
                }))}
              />
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-4 font-semibold">Department</th>
                      <th className="py-2 pr-4 font-semibold">Trips</th>
                      <th className="py-2 pr-4 font-semibold">Spend</th>
                      <th className="py-2 pr-4 font-semibold">Avg / trip</th>
                      <th className="py-2 pr-4 font-semibold">Saved</th>
                      <th className="py-2 font-semibold">Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDept.map((d) => (
                      <tr key={d.label} className="border-b border-slate-50">
                        <td className="py-2 pr-4 font-medium text-slate-800">{d.label}</td>
                        <td className="py-2 pr-4 text-slate-600">{d.trips}</td>
                        <td className="py-2 pr-4 text-slate-800">{money(d.spend)}</td>
                        <td className="py-2 pr-4 text-slate-600">
                          {money(Math.round(d.spend / Math.max(1, d.trips)))}
                        </td>
                        <td className="py-2 pr-4 text-emerald-600">{money(d.savings)}</td>
                        <td className="py-2 text-slate-500">{d.budget ? money(d.budget) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No bookings yet.</p>
          )}
        </Card>
      )}

      {/* ---------------- Employee ---------------- */}
      {level === 'employee' && (
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">Spend by employee</h2>
            <span className="text-sm text-slate-400">avg {money(avgSpend)} / traveller</span>
          </div>
          <p className="mb-5 text-sm text-slate-400">Committed travel spend per person.</p>
          {byEmployee.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-semibold">Employee</th>
                    <th className="py-2 pr-4 font-semibold">Department</th>
                    <th className="py-2 pr-4 font-semibold">Trips</th>
                    <th className="py-2 pr-4 font-semibold">Spend</th>
                    <th className="py-2 pr-4 font-semibold">Saved</th>
                    <th className="py-2 font-semibold">vs avg</th>
                  </tr>
                </thead>
                <tbody>
                  {byEmployee.map((e) => {
                    const diff = e.spend - avgSpend;
                    return (
                      <tr key={e.id} className="border-b border-slate-50">
                        <td className="py-2 pr-4 font-medium text-slate-800">{e.name}</td>
                        <td className="py-2 pr-4 text-slate-600">{e.dept}</td>
                        <td className="py-2 pr-4 text-slate-600">{e.trips}</td>
                        <td className="py-2 pr-4 text-slate-800">{money(e.spend)}</td>
                        <td className="py-2 pr-4 text-emerald-600">{money(e.savings)}</td>
                        <td
                          className={cn(
                            'py-2 font-medium',
                            diff > 0 ? 'text-amber-700' : 'text-slate-400'
                          )}
                        >
                          {diff > 0 ? `+${money(diff)}` : money(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No bookings yet.</p>
          )}
        </Card>
      )}

      {/* ---------------- Transactions (raw) ---------------- */}
      {level === 'transactions' && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Every transaction
              </h2>
              <p className="text-sm text-slate-400">
                {txns.length} bookings · the most detailed view, employee by trip.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportBookings}>
                ↓ Bookings CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportExpenses}>
                ↓ Expenses CSV
              </Button>
            </div>
          </div>
          {txns.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-semibold">Employee</th>
                    <th className="py-2 pr-4 font-semibold">Dept</th>
                    <th className="py-2 pr-4 font-semibold">Type</th>
                    <th className="py-2 pr-4 font-semibold">Trip</th>
                    <th className="py-2 pr-4 font-semibold">Airline / Room</th>
                    <th className="py-2 pr-4 font-semibold">Dates</th>
                    <th className="py-2 pr-4 font-semibold">Event</th>
                    <th className="py-2 pr-4 font-semibold">Price</th>
                    <th className="py-2 pr-4 font-semibold">Saved</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((b) => {
                    const trav = userById(b.travelerId);
                    return (
                      <tr key={b.id} className="border-b border-slate-50 align-top">
                        <td className="py-2 pr-4 font-medium text-slate-800">
                          {trav?.name ?? b.travelerId}
                        </td>
                        <td className="py-2 pr-4 text-slate-500">{b.department}</td>
                        <td className="py-2 pr-4 capitalize text-slate-600">{b.type}</td>
                        <td className="py-2 pr-4 text-slate-700">{b.title}</td>
                        <td className="py-2 pr-4 text-slate-500">
                          {b.type === 'flight' ? b.airline ?? '—' : b.roomType ?? '—'}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap text-slate-500">
                          {dateRange(b.startDate, b.endDate)}
                        </td>
                        <td className="py-2 pr-4 text-slate-500">{b.eventName ?? '—'}</td>
                        <td className="py-2 pr-4 font-medium text-slate-800">{money(b.price)}</td>
                        <td className="py-2 pr-4 text-emerald-600">
                          {b.savings > 0 ? money(b.savings) : '—'}
                        </td>
                        <td className="py-2 whitespace-nowrap text-slate-500">
                          {b.status === 'pending_approval'
                            ? 'Pending'
                            : b.status === 'cancelled'
                              ? 'Cancelled'
                              : `Confirmed · ${shortDate(b.createdAt)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No bookings yet.</p>
          )}
        </Card>
      )}
    </div>
  );
}
