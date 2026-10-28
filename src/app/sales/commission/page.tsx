'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCrm } from '@/lib/crmStore';
import type { CommissionScope } from '@/lib/crm';
import { placesHotels, type HotelPlace } from '@/lib/search';
import { Button, Card, PageHeader, cn } from '@/components/app/ui';
import { MapPin, Building, Check, Lock } from '@/components/icons';

/* ---------------- inline-editable percent (mirrors Nova) ---------------- */

function InlineEditablePercent({
  value,
  onSave,
  ariaLabel,
  canEdit = true,
}: {
  value: number;
  onSave: (pct: number) => void;
  ariaLabel?: string;
  canEdit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const n = Number(draft.trim());
    if (!draft.trim() || !Number.isFinite(n) || n < 0 || n > 100) {
      setErr('0–100');
      return;
    }
    if (n !== value) onSave(n);
    setEditing(false);
    setErr(null);
  };

  if (!canEdit) {
    return <span>{value.toFixed(2)}%</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setErr(null);
          setEditing(true);
        }}
        title="Click to edit"
        className="group inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-slate-100"
      >
        <span>{value.toFixed(2)}%</span>
        <span className="text-xs text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
          ✎
        </span>
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        ref={ref}
        type="number"
        step="0.01"
        min={0}
        max={100}
        value={draft}
        aria-label={ariaLabel ?? 'Commission percent'}
        onChange={(e) => {
          setDraft(e.target.value);
          setErr(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            setEditing(false);
            setErr(null);
          }
        }}
        onBlur={commit}
        className={cn(
          'w-16 rounded border px-2 py-1 text-sm outline-none focus:ring-2',
          err ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-slate-300'
        )}
      />
      <span className="text-slate-400">%</span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
      >
        ✓
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}

/* ---------------- scope badge ---------------- */

function ScopeBadge({ scope }: { scope: CommissionScope }) {
  const style =
    scope === 'star'
      ? 'bg-slate-100 text-slate-700'
      : scope === 'region'
        ? 'bg-sky-100 text-sky-700'
        : 'bg-purple-100 text-purple-700';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize', style)}>
      {scope === 'star' ? '★' : scope === 'region' ? <MapPin className="h-3 w-3" /> : <Building className="h-3 w-3" />}
      {scope}
    </span>
  );
}

/* ---------------- add / override search ---------------- */

function OverrideAdder({ scope }: { scope: 'hotel' | 'region' }) {
  const { upsertOverride } = useCrm();
  const isRegion = scope === 'region';
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<HotelPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<HotelPlace | null>(null);
  const [pct, setPct] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (selected && query === selected.label) return;
    const term = query.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const places = await placesHotels(term);
        if (live) setItems(places.filter((p) => p.type === scope).slice(0, 6));
      } catch {
        if (live) setItems([]);
      }
    }, 280);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, selected, scope]);

  const save = () => {
    if (!selected) return;
    const n = Number(pct.trim());
    if (!pct.trim() || !Number.isFinite(n) || n < 0 || n > 100) {
      setErr('Commission % must be between 0 and 100');
      return;
    }
    upsertOverride({
      scope,
      hotelHid: scope === 'hotel' ? Number(selected.hid) : null,
      regionId: scope === 'region' ? Number(selected.regionId) : null,
      targetLabel: selected.label,
      commissionPercent: n,
      reason: reason.trim() || undefined,
    });
    setSelected(null);
    setQuery('');
    setPct('');
    setReason('');
    setErr(null);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        {isRegion ? 'Add or update a region rule' : 'Add or update a hotel rule'}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {isRegion
          ? 'Search a city/region and set one commission for all its hotels. Individual hotel rules still override this.'
          : 'Search a hotel and set its own commission. A hotel rule overrides its region rule and the star-based rate.'}
      </p>

      <div className="relative mt-4">
        <label className="text-sm font-medium text-slate-700">
          {isRegion ? 'City or region' : 'Hotel'}
        </label>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected) setSelected(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={isRegion ? 'Search a city or region…' : 'Search a hotel…'}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          autoComplete="off"
        />
        {open && items.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {items.map((opt, i) => (
              <li key={`${opt.type}-${opt.hid ?? opt.regionId}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(opt);
                    setQuery(opt.label);
                    setItems([]);
                    setOpen(false);
                    setPct('');
                    setErr(null);
                  }}
                  className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                >
                  {opt.type === 'region' ? (
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <Building className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{opt.label}</span>
                    {opt.sub && <span className="block truncate text-sm text-slate-500">{opt.sub}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium capitalize">
              {selected.type}
            </span>
            <span className="font-medium text-slate-900">{selected.label}</span>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Commission % *</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="e.g. 15"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Change reason (optional)</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. negotiated rate"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                setQuery('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={save}>
              {isRegion ? 'Apply to all hotels in region' : 'Save hotel override'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

type Tab = 'active' | 'region' | 'hotel';
const TABS: { id: Tab; label: string }[] = [
  { id: 'active', label: 'Active commissions' },
  { id: 'region', label: 'Regions' },
  { id: 'hotel', label: 'Hotels' },
];
const ALL_STARS = [0, 1, 2, 3, 4, 5];

export default function CommissionPage() {
  const {
    commission,
    upsertStarRule,
    removeStarRule,
    upsertOverride,
    removeOverride,
    viewerRole,
    setViewerRole,
    companies,
    commissionApprovals,
    resolveCommissionApproval,
  } = useCrm();
  const canManage = viewerRole === 'C-Suite';
  const overrideCos = companies.filter((c) => c.customCommission);
  const pending = commissionApprovals.filter((a) => a.status === 'pending');
  const [tab, setTab] = useState<Tab>('active');
  const [addStar, setAddStar] = useState(false);
  const [historyFor, setHistoryFor] = useState<{ scope: CommissionScope; label: string } | null>(null);

  const availableStars = ALL_STARS.filter(
    (s) => !commission.starRules.some((r) => r.starRating === s)
  );

  const rows = useMemo(() => {
    const rank: Record<CommissionScope, number> = { star: 0, region: 1, hotel: 2 };
    const starRows = commission.starRules.map((r) => ({
      key: `star-${r.starRating}`,
      scope: 'star' as const,
      label: `${r.starRating}★`,
      pct: r.commissionPercent,
      starRating: r.starRating,
      hotelHid: null as number | null,
      regionId: null as number | null,
    }));
    const ovRows = commission.overrides.map((o) => ({
      key: `${o.scope}-${o.id}`,
      scope: o.scope,
      label: o.targetLabel,
      pct: o.commissionPercent,
      starRating: undefined,
      hotelHid: o.hotelHid ?? null,
      regionId: o.regionId ?? null,
    }));
    return [...starRows, ...ovRows].sort((a, b) =>
      rank[a.scope] !== rank[b.scope]
        ? rank[a.scope] - rank[b.scope]
        : a.scope === 'star'
          ? (a.starRating ?? 0) - (b.starRating ?? 0)
          : a.label.localeCompare(b.label)
    );
  }, [commission]);

  return (
    <div>
      <PageHeader
        title="Commission"
        subtitle="Set commission per hotel or region, with star ratings as the fallback. Hotel rules beat region rules; region rules beat the star-based rate."
        actions={
          <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
            {(['C-Suite', 'Account Executive'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setViewerRole(r)}
                className={cn(
                  'rounded-full px-3 py-1 font-semibold',
                  viewerRole === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                )}
              >
                {r === 'C-Suite' ? 'View as C-Suite' : 'View as Rep'}
              </button>
            ))}
          </div>
        }
      />

      {!canManage && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Only C-Suite can change the global commission. Reps manage per-company rates on each
            company&apos;s Commission tab (within −{1}%/+{2}% of global before approval).
          </span>
        </div>
      )}

      {overrideCos.length > 0 && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Not applying to:</span>{' '}
          {overrideCos.map((c) => c.name).join(', ')} — these accounts have a company-specific
          override. Visit the company profile to change it.
        </div>
      )}

      {pending.length > 0 && (
        <Card className="mb-5 border-amber-200 bg-amber-50/60">
          <h2 className="font-display text-base font-bold text-slate-900">
            {pending.length} commission change{pending.length === 1 ? '' : 's'} awaiting approval
          </h2>
          <div className="mt-2 space-y-1.5">
            {pending.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-amber-100"
              >
                <span className="text-slate-700">
                  <span className="font-medium">{a.companyName}</span> · {a.starRating}★ →{' '}
                  <span className="font-semibold">{a.toPercent}%</span>{' '}
                  <span className="text-slate-400">(global {a.globalPercent}%, by {a.requestedBy})</span>
                </span>
                {canManage ? (
                  <span className="flex gap-2">
                    <Button size="sm" onClick={() => resolveCommissionApproval(a.id, true)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolveCommissionApproval(a.id, false)}>
                      Reject
                    </Button>
                  </span>
                ) : (
                  <span className="text-xs font-medium text-amber-700">Pending C-Suite</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
              tab === t.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Every active commission rule — star tiers, region rules, and hotel overrides — in one
              place. Hotel beats region; region beats star.
            </p>
            {canManage && (
              <Button onClick={() => setAddStar(true)} disabled={availableStars.length === 0}>
                + Add star tier
              </Button>
            )}
          </div>

          <Card pad={false} className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Commission %</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-4 py-3">
                      <ScopeBadge scope={r.scope} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.label}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <InlineEditablePercent
                        value={r.pct}
                        canEdit={canManage}
                        ariaLabel={`Commission for ${r.label}`}
                        onSave={(p) =>
                          r.scope === 'star'
                            ? upsertStarRule(r.starRating as number, p)
                            : upsertOverride({
                                scope: r.scope,
                                hotelHid: r.hotelHid,
                                regionId: r.regionId,
                                targetLabel: r.label,
                                commissionPercent: p,
                              })
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryFor({ scope: r.scope, label: r.label })}
                        >
                          History
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              r.scope === 'star'
                                ? removeStarRule(r.starRating as number)
                                : removeOverride({
                                    scope: r.scope,
                                    hotelHid: r.hotelHid,
                                    regionId: r.regionId,
                                    targetLabel: r.label,
                                  })
                            }
                          >
                            <span className="text-red-600">Remove</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'region' && (
        <div className="space-y-8">
          {canManage && <OverrideAdder scope="region" />}
          <OverrideList scope="region" canEdit={canManage} />
        </div>
      )}

      {tab === 'hotel' && (
        <div className="space-y-8">
          {canManage && <OverrideAdder scope="hotel" />}
          <OverrideList scope="hotel" canEdit={canManage} />
        </div>
      )}

      {/* add star tier */}
      {addStar && (
        <AddStarDialog
          availableStars={availableStars}
          onClose={() => setAddStar(false)}
          onSubmit={(s, p, reason) => {
            upsertStarRule(s, p, reason);
            setAddStar(false);
          }}
        />
      )}

      {/* history */}
      {historyFor && (
        <HistoryDialog
          entries={commission.history.filter(
            (h) => h.scope === historyFor.scope && h.targetLabel === historyFor.label
          )}
          label={historyFor.label}
          scope={historyFor.scope}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}

function OverrideList({ scope, canEdit = true }: { scope: 'hotel' | 'region'; canEdit?: boolean }) {
  const { commission, upsertOverride, removeOverride } = useCrm();
  const scoped = commission.overrides.filter((o) => o.scope === scope);
  const isRegion = scope === 'region';
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        {isRegion ? 'Active region rules' : 'Active hotel overrides'}
      </h2>
      {scoped.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          {isRegion
            ? 'No region rules yet. Regions follow the star-based rate until you add one.'
            : 'No hotel overrides yet. Hotels follow their region or star-based rate until you add one.'}
        </p>
      ) : (
        <Card pad={false} className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Commission %</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scoped.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{o.targetLabel}</div>
                    <div className="text-xs text-slate-400">
                      {o.scope === 'hotel' ? `hid ${o.hotelHid}` : `region ${o.regionId}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <InlineEditablePercent
                      value={o.commissionPercent}
                      canEdit={canEdit}
                      ariaLabel={`Commission for ${o.targetLabel}`}
                      onSave={(p) =>
                        upsertOverride({
                          scope: o.scope,
                          hotelHid: o.hotelHid,
                          regionId: o.regionId,
                          targetLabel: o.targetLabel,
                          commissionPercent: p,
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() =>
                            removeOverride({
                              scope: o.scope,
                              hotelHid: o.hotelHid,
                              regionId: o.regionId,
                              targetLabel: o.targetLabel,
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function AddStarDialog({
  availableStars,
  onClose,
  onSubmit,
}: {
  availableStars: number[];
  onClose: () => void;
  onSubmit: (star: number, pct: number, reason?: string) => void;
}) {
  const [star, setStar] = useState(availableStars[0] ?? 0);
  const [pct, setPct] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Overlay onClose={onClose}>
      <h2 className="font-display text-lg font-bold text-slate-900">Add star tier</h2>
      <p className="mt-1 text-sm text-slate-500">
        Create a commission rule for a star rating that doesn&apos;t have one yet.
      </p>
      <div className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Star rating *</label>
          <select
            value={star}
            onChange={(e) => setStar(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
          >
            {availableStars.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? '0★ (unrated / unknown)' : `${s}★`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Commission % *</label>
          <input
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="e.g. 15"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Change reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            const n = Number(pct.trim());
            if (!pct.trim() || !Number.isFinite(n) || n < 0 || n > 100) {
              setErr('Commission % must be between 0 and 100');
              return;
            }
            onSubmit(star, n, reason.trim() || undefined);
          }}
        >
          Add star tier
        </Button>
      </div>
    </Overlay>
  );
}

function HistoryDialog({
  entries,
  label,
  scope,
  onClose,
}: {
  entries: import('@/lib/crm').CommissionHistoryEntry[];
  label: string;
  scope: CommissionScope;
  onClose: () => void;
}) {
  return (
    <Overlay onClose={onClose}>
      <h2 className="font-display text-lg font-bold text-slate-900">Change history</h2>
      <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
        <ScopeBadge scope={scope} /> <strong className="text-slate-700">{label}</strong>
      </p>
      <div className="mt-4 max-h-[50vh] overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No history yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {entries.map((h) => (
              <li key={h.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium capitalize text-slate-800">
                    {h.action}:{' '}
                    {h.oldPercent != null ? `${h.oldPercent.toFixed(2)}%` : '—'} →{' '}
                    {h.newPercent != null ? `${h.newPercent.toFixed(2)}%` : '—'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(h.changedAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {h.changedBy}
                  {h.reason ? ` · ${h.reason}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </Overlay>
  );
}
