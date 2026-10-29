'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  placesFlights,
  placesHotels,
  searchFlights,
  startHotels,
  type FlightPlace,
  type HotelPlace,
} from '@/lib/search';
import { HvRangeField } from '@/components/datepicker/HvDatePicker';
import { format as fmtDate, parseISO } from 'date-fns';
import { Button, Card, Field, Input, PageHeader, Badge, cn } from '@/components/app/ui';
import { money, num, addDays, todayISO, dateRange, uid } from '@/lib/format';
import { Plane, Building, Check, Shield, ArrowRight, Sparkles } from '@/components/icons';
import type { InventoryOption, PlannedItem, TripPlan } from '@/lib/types';

const toISO = (d: Date) => fmtDate(d, 'yyyy-MM-dd');

export default function PlanTripPage() {
  const { state, activeUser, role, evaluatePolicies, savePlan, submitPlan, resolvePlan } = useStore();

  // ---- plan composer ----
  const [origin, setOrigin] = useState<FlightPlace | null>(null);
  const [originText, setOriginText] = useState('');
  const [dest, setDest] = useState<HotelPlace | null>(null);
  const [destText, setDestText] = useState('');
  const [start, setStart] = useState(addDays(todayISO(), 14));
  const [end, setEnd] = useState(addDays(todayISO(), 17));

  const [flights, setFlights] = useState<InventoryOption[] | null>(null);
  const [hotels, setHotels] = useState<InventoryOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickFlight, setPickFlight] = useState<InventoryOption | null>(null);
  const [pickHotel, setPickHotel] = useState<InventoryOption | null>(null);

  const dStart = start ? parseISO(start) : undefined;
  const dEnd = end ? parseISO(end) : undefined;

  const assess = (opt: InventoryOption): { inPolicy: boolean; flags: string[] } => {
    const fl = evaluatePolicies(opt, start);
    const blocking = fl.some((f) => f.policy.action === 'block' || f.policy.action === 'approve');
    return { inPolicy: !blocking, flags: fl.map((f) => f.message) };
  };

  const search = async () => {
    if (!origin || !dest) {
      setError('Pick where you’re flying from and to.');
      return;
    }
    if (new Date(end) <= new Date(start)) {
      setError('Return / check-out must be after departure / check-in.');
      return;
    }
    setError(null);
    setLoading(true);
    setFlights(null);
    setHotels(null);
    setPickFlight(null);
    setPickHotel(null);
    try {
      // Resolve the destination airport from its city for the flight leg.
      const destAirports = await placesFlights(dest.label.split(',')[0]);
      const destCode = destAirports[0]?.code ?? '';
      const [fl, hp] = await Promise.all([
        destCode
          ? searchFlights({
              origin: origin.code,
              destination: destCode,
              departDate: start,
              returnDate: end,
              adults: 1,
            })
          : Promise.resolve([]),
        startHotels({
          regionId: dest.regionId,
          lat: dest.lat,
          lng: dest.lng,
          checkin: start,
          checkout: end,
          adults: 1,
          pageSize: 6,
        }),
      ]);
      setFlights(fl.slice(0, 5));
      setHotels(hp.options.slice(0, 5));
    } catch {
      setError('Could not load options. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const plannedFlight: PlannedItem | null = pickFlight
    ? { opt: pickFlight, startDate: start, endDate: end, ...assess(pickFlight) }
    : null;
  const plannedHotel: PlannedItem | null = pickHotel
    ? {
        opt: pickHotel,
        startDate: start,
        endDate: end,
        roomType: pickHotel.detail,
        ...assess(pickHotel),
      }
    : null;

  const total = (plannedFlight?.opt.price ?? 0) + (plannedHotel?.opt.price ?? 0);
  const bothPicked = !!plannedFlight && !!plannedHotel;
  const allInPolicy = bothPicked && plannedFlight!.inPolicy && plannedHotel!.inPolicy;

  const submit = () => {
    if (!bothPicked || !dest) return;
    const plan: TripPlan = {
      id: uid('plan'),
      travelerId: activeUser.id,
      destination: dest.label.split(',')[0],
      startDate: start,
      endDate: end,
      flight: plannedFlight!,
      hotel: plannedHotel!,
      status: 'pending_approval',
      createdAt: todayISO(),
    };
    savePlan(plan);
    submitPlan(plan.id);
    // Reset composer.
    setPickFlight(null);
    setPickHotel(null);
    setFlights(null);
    setHotels(null);
  };

  const myPlans = (state.tripPlans ?? []).filter((p) => p.travelerId === activeUser.id);
  const pendingForApproval = (state.tripPlans ?? []).filter((p) => p.status === 'pending_approval');
  const canApprove = role === 'admin';

  return (
    <div className="pb-10">
      <PageHeader
        title="Plan a trip"
        subtitle="Need both a flight and a hotel? Pick each, see what's in policy, and submit the whole trip for approval at once."
      />

      {/* composer */}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Typeahead
            label="Flying from"
            placeholder="City or airport"
            value={originText}
            onText={setOriginText}
            fetcher={async (q) => (await placesFlights(q)).map((p) => ({ key: p.code, label: p.label, sub: p.sub, data: p }))}
            onPick={(s) => {
              setOrigin(s.data as FlightPlace);
              setOriginText(s.label);
            }}
          />
          <Typeahead
            label="Going to"
            placeholder="City"
            value={destText}
            onText={setDestText}
            fetcher={async (q) =>
              (await placesHotels(q))
                .filter((p) => p.type === 'region')
                .map((p) => ({ key: `r${p.regionId}`, label: p.label, sub: p.sub, data: p }))
            }
            onPick={(s) => {
              setDest(s.data as HotelPlace);
              setDestText(s.label);
            }}
          />
          <Field label="Dates">
            <HvRangeField
              value={{ from: dStart, to: dEnd }}
              maxRangeDays={30}
              onChange={(r) => {
                if (r?.from) setStart(toISO(r.from));
                if (r?.to) setEnd(toISO(r.to));
              }}
            />
          </Field>
          <div className="flex items-end">
            <Button className="w-full" onClick={search} disabled={loading}>
              {loading ? 'Searching…' : 'Find flight + hotel'}
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      {/* results */}
      {(flights || hotels) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <OptionList
            icon={<Plane className="h-4 w-4" />}
            title="Pick your flight"
            options={flights}
            picked={pickFlight}
            onPick={setPickFlight}
            assess={assess}
          />
          <OptionList
            icon={<Building className="h-4 w-4" />}
            title="Pick your hotel"
            options={hotels}
            picked={pickHotel}
            onPick={setPickHotel}
            assess={assess}
          />
        </div>
      )}

      {/* review */}
      {bothPicked && (
        <Card className="mt-6 border-brand/30 bg-brand/5">
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900">Review your trip</h2>
          <p className="mb-3 text-xs text-slate-500">
            {dest?.label} · {dateRange(start, end)}
          </p>
          <div className="space-y-2">
            <ReviewLeg label="Flight" item={plannedFlight!} />
            <ReviewLeg label="Hotel" item={plannedHotel!} />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-brand/20 pt-3">
            <span className="text-sm font-semibold text-slate-700">Trip total</span>
            <span className="font-display text-xl font-bold text-slate-900">{money(total)}</span>
          </div>
          <div
            className={cn(
              'mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
              allInPolicy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            )}
          >
            <Shield className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {allInPolicy
                ? 'Both legs are in policy. Submit and your manager just confirms.'
                : 'Some of this trip is out of policy — submit it and your manager will review.'}{' '}
              Once approved, we process payment and book both automatically — you won’t need to come
              back, and you’ll get an email with both confirmation numbers.
            </span>
          </div>
          <Button className="mt-4" onClick={submit}>
            Submit trip for approval <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      )}

      {/* admin: pending plans */}
      {canApprove && pendingForApproval.length > 0 && (
        <Card className="mt-6 border-amber-200 bg-amber-50/60">
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
            Trip plans awaiting approval
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Approving books both the flight and hotel and emails the traveler the confirmations.
          </p>
          <div className="space-y-2">
            {pendingForApproval.map((p) => (
              <PlanApprovalRow
                key={p.id}
                plan={p}
                travelerName={state.users.find((u) => u.id === p.travelerId)?.name ?? '—'}
                onResolve={resolvePlan}
              />
            ))}
          </div>
        </Card>
      )}

      {/* my plans */}
      {myPlans.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Your trip plans</h2>
          <div className="space-y-2">
            {myPlans.map((p) => (
              <MyPlanRow key={p.id} plan={p} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- bits ---------------- */

type Sug = { key: string; label: string; sub: string; data: unknown };

function Typeahead({
  label,
  placeholder,
  value,
  onText,
  fetcher,
  onPick,
}: {
  label: string;
  placeholder: string;
  value: string;
  onText: (v: string) => void;
  fetcher: (q: string) => Promise<Sug[]>;
  onPick: (s: Sug) => void;
}) {
  const [items, setItems] = useState<Sug[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetcher(q);
        if (live) setItems(r.slice(0, 6));
      } catch {
        if (live) setItems([]);
      }
    }, 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Field label={label}>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {open && items.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(s);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{s.label}</span>
                  {s.sub && <span className="text-xs text-slate-400">{s.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

function OptionList({
  icon,
  title,
  options,
  picked,
  onPick,
  assess,
}: {
  icon: React.ReactNode;
  title: string;
  options: InventoryOption[] | null;
  picked: InventoryOption | null;
  onPick: (o: InventoryOption) => void;
  assess: (o: InventoryOption) => { inPolicy: boolean; flags: string[] };
}) {
  return (
    <Card>
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        {icon} {title}
      </p>
      {options == null ? (
        <p className="py-6 text-center text-sm text-slate-400">Searching…</p>
      ) : options.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No options found.</p>
      ) : (
        <div className="space-y-2">
          {options.map((o) => {
            const a = assess(o);
            const sel = picked?.id === o.id;
            return (
              <button
                key={o.id}
                onClick={() => onPick(o)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors',
                  sel ? 'border-brand bg-brand/8 ring-1 ring-brand/40' : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{o.title}</p>
                  <p className="truncate text-xs text-slate-400">{o.detail}</p>
                  <div className="mt-1">
                    {a.inPolicy ? (
                      <Badge color="green">In policy</Badge>
                    ) : (
                      <Badge color="amber">Out of policy</Badge>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-base font-bold text-slate-900">{money(o.price)}</p>
                  {sel && <Check className="ml-auto mt-1 h-4 w-4 text-brand-dark" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ReviewLeg({ label, item }: { label: string; item: PlannedItem }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800">{item.opt.title}</p>
        <div className="mt-0.5">
          {item.inPolicy ? (
            <Badge color="green">In policy</Badge>
          ) : (
            <Badge color="amber">Out of policy</Badge>
          )}
        </div>
      </div>
      <span className="font-semibold text-slate-900">{money(item.opt.price)}</span>
    </div>
  );
}

function PlanApprovalRow({
  plan,
  travelerName,
  onResolve,
}: {
  plan: TripPlan;
  travelerName: string;
  onResolve: (id: string, approve: boolean, note?: string) => void;
}) {
  const total = (plan.flight?.opt.price ?? 0) + (plan.hotel?.opt.price ?? 0);
  const allIn = (plan.flight?.inPolicy ?? true) && (plan.hotel?.inPolicy ?? true);
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            {travelerName} · {plan.destination}
          </p>
          <p className="text-xs text-slate-400">
            {dateRange(plan.startDate, plan.endDate)} · {money(total)} ·{' '}
            {allIn ? 'all in policy' : 'has out-of-policy items'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onResolve(plan.id, true)}>
            Approve &amp; book
          </Button>
          <Button size="sm" variant="outline" onClick={() => onResolve(plan.id, false)}>
            Decline
          </Button>
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        <span className="inline-flex items-center gap-1">
          <Plane className="h-3.5 w-3.5" /> {plan.flight?.opt.title}
        </span>
        <span className="inline-flex items-center gap-1">
          <Building className="h-3.5 w-3.5" /> {plan.hotel?.opt.title}
        </span>
      </div>
    </div>
  );
}

function MyPlanRow({ plan }: { plan: TripPlan }) {
  const total = (plan.flight?.opt.price ?? 0) + (plan.hotel?.opt.price ?? 0);
  const label =
    plan.status === 'booked'
      ? 'Booked'
      : plan.status === 'pending_approval'
        ? 'Pending approval'
        : plan.status === 'declined'
          ? 'Declined'
          : 'Planning';
  const color =
    plan.status === 'booked' ? 'green' : plan.status === 'declined' ? 'red' : 'amber';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            Trip to {plan.destination} <Badge color={color}>{label}</Badge>
          </p>
          <p className="text-xs text-slate-400">
            {dateRange(plan.startDate, plan.endDate)} · {money(total)} ·{' '}
            {num(
              (plan.flight ? 1 : 0) + (plan.hotel ? 1 : 0)
            )}{' '}
            legs
          </p>
        </div>
        {plan.status === 'booked' && (
          <div className="text-right text-xs text-slate-500">
            {plan.flight?.confirmation && (
              <p>
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-brand-dark" /> Flight {plan.flight.confirmation}
                </span>
              </p>
            )}
            {plan.hotel?.confirmation && <p>Hotel {plan.hotel.confirmation}</p>}
          </div>
        )}
      </div>
      {plan.status === 'declined' && plan.reviewNote && (
        <p className="mt-1 text-xs text-red-600">Manager: {plan.reviewNote}</p>
      )}
    </div>
  );
}
