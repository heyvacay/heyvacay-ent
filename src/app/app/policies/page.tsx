'use client';

import { useStore } from '@/lib/store';
import { Button, Card, PageHeader, Select, cn } from '@/components/app/ui';
import { Plane, Receipt, Shield, Check, Calendar } from '@/components/icons';
import type { FlightCabinTier, Policy, PolicyAction } from '@/lib/types';

const CABINS = ['Economy', 'Premium economy', 'Business', 'First'];
const ACTIONS: { value: PolicyAction; label: string }[] = [
  { value: 'allow', label: 'Allow' },
  { value: 'warn', label: 'Warn traveler' },
  { value: 'approve', label: 'Needs approval' },
  { value: 'block', label: 'Block booking' },
];

function cabinRank(cabin: string): number {
  const c = cabin.toLowerCase();
  if (c.includes('first')) return 3;
  if (c.includes('business')) return 2;
  if (c.includes('premium')) return 1;
  return 0;
}

/* ---------------- small controls ---------------- */

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        on ? 'bg-brand' : 'bg-slate-200'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          on ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

function ActionSelect({
  value,
  onChange,
}: {
  value: PolicyAction;
  onChange: (a: PolicyAction) => void;
}) {
  return (
    <span className="inline-block w-44 align-middle">
      <Select value={value} onChange={(e) => onChange(e.target.value as PolicyAction)}>
        {ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </Select>
    </span>
  );
}

function NumInput({
  value,
  onChange,
  width = 'w-20',
  suffix,
  prefix,
}: {
  value: number;
  onChange: (n: number) => void;
  width?: string;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {prefix && <span className="text-slate-500">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          width,
          'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-semibold text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25'
        )}
      />
      {suffix && <span className="text-slate-500">{suffix}</span>}
    </span>
  );
}

/** A rule row: plain-English sentence on the left, action + toggle on the right. */
function Rule({
  enabled,
  onToggle,
  children,
  action,
  onAction,
}: {
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: PolicyAction;
  onAction?: (a: PolicyAction) => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between',
        !enabled && 'opacity-60'
      )}
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm text-slate-700">
        {children}
      </div>
      <div className="flex items-center gap-3">
        {action && onAction && <ActionSelect value={action} onChange={onAction} />}
        <Toggle on={enabled} onClick={onToggle} />
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-dark">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-400">{sub}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

/* ---------------- flight preview ---------------- */

const SAMPLE_FLIGHTS = [
  { route: 'SFO → LAX', hours: 1.5 },
  { route: 'SFO → ORD', hours: 4.2 },
  { route: 'JFK → LHR', hours: 7 },
  { route: 'SFO → LHR', hours: 10.5 },
  { route: 'JFK → NRT', hours: 14 },
];

function allowedCabin(tiers: FlightCabinTier[], hours: number): string {
  const sorted = [...tiers].sort(
    (a, b) => (a.upToHours ?? Infinity) - (b.upToHours ?? Infinity)
  );
  const tier =
    sorted.find((t) => t.upToHours == null || hours <= t.upToHours) ??
    sorted[sorted.length - 1];
  return tier?.cabin ?? 'Economy';
}

function FlightPreview({ tiers }: { tiers: FlightCabinTier[] }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Preview — what each flight length allows
      </p>
      <div className="space-y-1.5">
        {SAMPLE_FLIGHTS.map((f) => (
          <div
            key={f.route}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-slate-600">
              {f.route}{' '}
              <span className="text-slate-400">· {f.hours}h</span>
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-brand-dark">
              <Check className="h-3.5 w-3.5" /> up to {allowedCabin(tiers, f.hours)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function PoliciesPage() {
  const { state, togglePolicy, updatePolicy } = useStore();
  const byType = (t: Policy['type']) => state.policies.find((p) => p.type === t);

  const nightly = byType('max_nightly');
  const star = byType('max_hotel_star');
  const flight = byType('flight_cabin_by_duration');
  const advance = byType('advance_days');

  const setTiers = (tiers: FlightCabinTier[]) =>
    flight && updatePolicy(flight.id, { tiers });

  const tiers = flight?.tiers ?? [];
  const numericTiers = tiers.filter((t) => t.upToHours != null);
  const openTier = tiers.find((t) => t.upToHours == null);

  const addTier = () => {
    const last = numericTiers[numericTiers.length - 1]?.upToHours ?? 2;
    const next: FlightCabinTier = { upToHours: Number(last) + 4, cabin: 'Economy' };
    setTiers([...numericTiers, next, openTier ?? { upToHours: null, cabin: 'Business' }]);
  };
  const updateTier = (i: number, patch: Partial<FlightCabinTier>) => {
    const copy = numericTiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    setTiers([...copy, openTier ?? { upToHours: null, cabin: 'Business' }]);
  };
  const removeTier = (i: number) => {
    const copy = numericTiers.filter((_, idx) => idx !== i);
    setTiers([...copy, openTier ?? { upToHours: null, cabin: 'Business' }]);
  };

  return (
    <div>
      <PageHeader
        title="Travel policy"
        subtitle="Plain-English rules that run the moment someone books — edit any number right in the sentence."
      />

      <div className="space-y-6">
        {/* Hotels */}
        <SectionCard
          icon={<Receipt className="h-5 w-5" />}
          title="Hotels"
          sub="Caps on nightly rate and hotel class."
        >
          {nightly && (
            <Rule
              enabled={nightly.enabled}
              onToggle={() => togglePolicy(nightly.id)}
              action={nightly.action}
              onAction={(a) => updatePolicy(nightly.id, { action: a })}
            >
              <span>Hotel rooms over</span>
              <NumInput
                prefix="$"
                value={Number(nightly.value)}
                onChange={(n) => updatePolicy(nightly.id, { value: n })}
              />
              <span>per night</span>
            </Rule>
          )}
          {star && (
            <Rule
              enabled={star.enabled}
              onToggle={() => togglePolicy(star.id)}
              action={star.action}
              onAction={(a) => updatePolicy(star.id, { action: a })}
            >
              <span>Hotels above</span>
              <span className="inline-block w-20 align-middle">
                <Select
                  value={String(star.value)}
                  onChange={(e) => updatePolicy(star.id, { value: Number(e.target.value) })}
                >
                  {[3, 4, 5].map((s) => (
                    <option key={s} value={s}>
                      {s}★
                    </option>
                  ))}
                </Select>
              </span>
              <span>stars</span>
            </Rule>
          )}
        </SectionCard>

        {/* Flights */}
        <SectionCard
          icon={<Plane className="h-5 w-5" />}
          title="Flights"
          sub="Allow a higher cabin as flights get longer — set a tier per flight length."
        >
          {flight && (
            <div
              className={cn(
                'rounded-xl border border-slate-200 p-4',
                !flight.enabled && 'opacity-60'
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  Cabin by flight length
                </p>
                <div className="flex items-center gap-3">
                  <ActionSelect
                    value={flight.action}
                    onChange={(a) => updatePolicy(flight.id, { action: a })}
                  />
                  <Toggle
                    on={flight.enabled}
                    onClick={() => togglePolicy(flight.id)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {numericTiers.map((t, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-1.5 text-sm text-slate-700"
                  >
                    <span>Flights up to</span>
                    <NumInput
                      value={Number(t.upToHours)}
                      onChange={(n) => updateTier(i, { upToHours: n })}
                      width="w-16"
                      suffix="h"
                    />
                    <span>→</span>
                    <span className="inline-block w-52 align-middle">
                      <Select
                        value={t.cabin}
                        onChange={(e) => updateTier(i, { cabin: e.target.value })}
                      >
                        {CABINS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </span>
                    <button
                      onClick={() => removeTier(i)}
                      className="ml-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {openTier && (
                  <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-700">
                    <span>Flights longer than that</span>
                    <span>→</span>
                    <span className="inline-block w-52 align-middle">
                      <Select
                        value={openTier.cabin}
                        onChange={(e) =>
                          setTiers([
                            ...numericTiers,
                            { upToHours: null, cabin: e.target.value },
                          ])
                        }
                      >
                        {CABINS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </span>
                  </div>
                )}
              </div>

              <Button variant="ghost" size="sm" className="mt-2" onClick={addTier}>
                + Add tier
              </Button>

              <div className="mt-4">
                <FlightPreview tiers={tiers} />
              </div>
            </div>
          )}
        </SectionCard>

        {/* Advance booking */}
        <SectionCard
          icon={<Calendar className="h-5 w-5" />}
          title="Advance booking"
          sub="Encourage booking early for better fares."
        >
          {advance && (
            <Rule
              enabled={advance.enabled}
              onToggle={() => togglePolicy(advance.id)}
              action={advance.action}
              onAction={(a) => updatePolicy(advance.id, { action: a })}
            >
              <span>Trips booked fewer than</span>
              <NumInput
                value={Number(advance.value)}
                onChange={(n) => updatePolicy(advance.id, { value: n })}
                width="w-16"
              />
              <span>days ahead</span>
            </Rule>
          )}
        </SectionCard>

        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5" /> Changes apply instantly. &quot;Needs
          approval&quot; routes a booking to an admin; &quot;Block&quot; stops it
          outright.
        </p>
      </div>
    </div>
  );
}
