'use client';

import { useMemo, useState } from 'react';
import { useCrm } from '@/lib/crmStore';
import { blendedHotelRate, type CommissionConfig } from '@/lib/crm';
import { Button, Card, PageHeader, cn } from '@/components/app/ui';
import { money } from '@/lib/format';
import { TrendUp, Shield, Check } from '@/components/icons';

const STARS = [5, 4, 3, 2, 1];

/** Estimated annual commission a company throws off under a given config. */
function annualCommission(annualSpend: number, cfg: CommissionConfig): number {
  // Assume ~80% hotels / 20% flights of managed spend (demo heuristic).
  return Math.round(
    annualSpend * 0.8 * (blendedHotelRate(cfg) / 100) + annualSpend * 0.2 * (cfg.flightPct / 100)
  );
}

function StarEditor({
  cfg,
  onChange,
  compact,
}: {
  cfg: CommissionConfig;
  onChange: (cfg: CommissionConfig) => void;
  compact?: boolean;
}) {
  const setStar = (s: number, v: number) =>
    onChange({ ...cfg, starRates: { ...cfg.starRates, [String(s)]: Math.max(0, Math.min(40, v)) } });
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-6' : 'grid-cols-2 sm:grid-cols-3')}>
      {STARS.map((s) => (
        <label key={s} className="flex items-center gap-2">
          <span className={cn('font-semibold text-amber-500', compact ? 'text-xs' : 'text-sm')}>
            {s}★
          </span>
          <span className="relative flex-1">
            <input
              type="number"
              value={cfg.starRates[String(s)] ?? 0}
              onChange={(e) => setStar(s, Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 pr-6 text-right text-sm font-semibold text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              %
            </span>
          </span>
        </label>
      ))}
      {!compact && (
        <label className="flex items-center gap-2">
          <span className="text-sm font-semibold text-sky-600">✈</span>
          <span className="relative flex-1">
            <input
              type="number"
              value={cfg.flightPct}
              onChange={(e) =>
                onChange({ ...cfg, flightPct: Math.max(0, Math.min(40, Number(e.target.value))) })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 pr-6 text-right text-sm font-semibold text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              %
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

export default function CommissionPage() {
  const {
    companies,
    commission,
    setCommission,
    setCustomCommission,
    setCompanyCommission,
    commissionFor,
  } = useCrm();

  const [draft, setDraft] = useState<CommissionConfig>(commission);
  const [ovName, setOvName] = useState('');
  const [ovPct, setOvPct] = useState(12);
  const [saved, setSaved] = useState(false);

  const customCos = companies.filter((c) => c.customCommission);
  const governed = companies.filter((c) => !c.customCommission);

  // Projected annual commission across the book of business: governed companies
  // move with the draft; custom companies keep their own rates.
  const projectedDraft = useMemo(
    () =>
      governed.reduce((s, c) => s + annualCommission(c.annualSpend, draft), 0) +
      customCos.reduce((s, c) => s + annualCommission(c.annualSpend, commissionFor(c.id)), 0),
    [governed, customCos, draft, commissionFor]
  );
  const projectedSaved = useMemo(
    () =>
      governed.reduce((s, c) => s + annualCommission(c.annualSpend, commission), 0) +
      customCos.reduce((s, c) => s + annualCommission(c.annualSpend, commissionFor(c.id)), 0),
    [governed, customCos, commission, commissionFor]
  );
  const delta = projectedDraft - projectedSaved;

  const save = () => {
    setCommission(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const addOverride = () => {
    const name = ovName.trim();
    if (!name) return;
    setDraft({
      ...draft,
      hotelOverrides: [...draft.hotelOverrides.filter((o) => o.name !== name), { name, pct: ovPct }],
    });
    setOvName('');
  };

  return (
    <div>
      <PageHeader
        title="Commission"
        subtitle="Set what HeyVacay earns across every account. The more commission, the more we make — tune by hotel star tier, with per-hotel overrides."
      />

      {/* projected revenue — higher is better */}
      <Card className="mb-6 border-brand/20 bg-gradient-to-br from-navy via-surface to-navy-deep text-white">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              Projected annual commission
            </p>
            <p className="mt-1 font-display text-4xl font-extrabold">{money(projectedDraft)}</p>
            <p className="mt-1 text-sm text-mist/70">
              Across {companies.length} accounts · {governed.length} on the global rate
            </p>
          </div>
          <div className="text-right">
            {delta !== 0 ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold',
                  delta > 0 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-red-400/20 text-red-200'
                )}
              >
                <TrendUp className="h-4 w-4" />
                {delta > 0 ? '+' : ''}
                {money(delta)}/yr vs saved
              </span>
            ) : (
              <span className="text-sm text-mist/60">Matches your saved rates</span>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* global rates */}
        <Card>
          <h2 className="font-display text-lg font-bold text-slate-900">Global rates</h2>
          <p className="mb-4 text-sm text-slate-400">
            Commission by hotel star tier, plus a base flight rate. Applies to every account that
            isn&apos;t set to custom.
          </p>
          <StarEditor cfg={draft} onChange={setDraft} />

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Hotel-specific overrides</p>
            {draft.hotelOverrides.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {draft.hotelOverrides.map((o) => (
                  <div
                    key={o.name}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-800">{o.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold text-brand-dark">{o.pct}%</span>
                      <button
                        onClick={() =>
                          setDraft({
                            ...draft,
                            hotelOverrides: draft.hotelOverrides.filter((x) => x.name !== o.name),
                          })
                        }
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={ovName}
                onChange={(e) => setOvName(e.target.value)}
                placeholder="Hotel name"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <span className="relative w-20">
                <input
                  type="number"
                  value={ovPct}
                  onChange={(e) => setOvPct(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 pr-6 text-right text-sm font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  %
                </span>
              </span>
              <Button variant="outline" onClick={addOverride}>
                Add
              </Button>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
            <Button onClick={save}>Save global rates</Button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
          </div>

          {/* exclusion notice */}
          {customCos.length > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                These accounts have custom commission and <strong>will not</strong> reflect global
                changes: {customCos.map((c) => c.name).join(', ')}.
              </span>
            </div>
          )}
        </Card>

        {/* per-company */}
        <Card>
          <h2 className="font-display text-lg font-bold text-slate-900">Accounts</h2>
          <p className="mb-4 text-sm text-slate-400">
            Every account follows the global rate unless you check <em>Custom</em> — then set its
            own rates below.
          </p>
          <div className="space-y-2">
            {companies.map((c) => {
              const eff = commissionFor(c.id);
              return (
                <div key={c.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">
                        {money(c.annualSpend)}/yr · ~{money(annualCommission(c.annualSpend, eff))}{' '}
                        commission
                      </p>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={!!c.customCommission}
                        onChange={(e) => setCustomCommission(c.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                      />
                      Custom
                    </label>
                  </div>
                  {c.customCommission && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <StarEditor
                        cfg={eff}
                        compact
                        onChange={(cfg) => setCompanyCommission(c.id, cfg)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
