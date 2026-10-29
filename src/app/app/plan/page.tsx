'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Plane, Building, Shield, ArrowRight, Sparkles } from '@/components/icons';
import { rewardsFor } from '@/lib/rewards';
import { FlightRow, HotelCard, type Sig } from '@/components/app/results';
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

  // The enterprise overlay the shared result cards render: policy + rewards.
  const sigFor = (opt: InventoryOption): Sig => ({
    flags: evaluatePolicies(opt, start),
    ...rewardsFor({ type: opt.type as 'flight' | 'hotel', marketPrice: opt.marketPrice, price: opt.price }),
  });

  const runSearch = async (o: FlightPlace, d: HotelPlace, s: string, e: string) => {
    if (new Date(e) <= new Date(s)) {
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
      const destAirports = await placesFlights(d.label.split(',')[0]);
      const destCode = destAirports[0]?.code ?? '';
      const [fl, hp] = await Promise.all([
        destCode
          ? searchFlights({
              origin: o.code,
              destination: destCode,
              departDate: s,
              returnDate: e,
              adults: 1,
            })
          : Promise.resolve([]),
        startHotels({
          regionId: d.regionId,
          lat: d.lat,
          lng: d.lng,
          checkin: s,
          checkout: e,
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

  const search = () => {
    if (!origin || !dest) {
      setError('Pick where you’re flying from and to.');
      return;
    }
    runSearch(origin, dest, start, end);
  };

  // Pre-fill + auto-search when we arrive from a single booking ("add a hotel /
  // add a flight") — the confirmation screen passes dest/origin/dates in the URL.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      return;
    }
    const pDest = params.get('dest');
    const pOrigin = params.get('origin');
    const pStart = params.get('start');
    const pEnd = params.get('end');
    if (!pDest && !pOrigin) return;
    if (pStart) setStart(pStart);
    if (pEnd) setEnd(pEnd);
    (async () => {
      try {
        let o: FlightPlace | null = origin;
        let d: HotelPlace | null = dest;
        if (pOrigin) {
          const matches = await placesFlights(pOrigin);
          if (matches[0]) {
            o = matches[0];
            setOrigin(matches[0]);
            setOriginText(matches[0].label);
          }
        }
        if (pDest) {
          const regions = (await placesHotels(pDest)).filter((p) => p.type === 'region');
          if (regions[0]) {
            d = regions[0];
            setDest(regions[0]);
            setDestText(regions[0].label);
          } else {
            setDestText(pDest);
          }
        }
        if (o && d) runSearch(o, d, pStart || start, pEnd || end);
      } catch {
        /* leave the composer for the user to complete */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const anyPicked = !!plannedFlight || !!plannedHotel;
  const allInPolicy =
    anyPicked && (plannedFlight?.inPolicy ?? true) && (plannedHotel?.inPolicy ?? true);

  const submit = () => {
    if (!anyPicked || !dest) return;
    const plan: TripPlan = {
      id: uid('plan'),
      travelerId: activeUser.id,
      destination: dest.label.split(',')[0],
      startDate: start,
      endDate: end,
      flight: plannedFlight ?? undefined,
      hotel: plannedHotel ?? undefined,
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
        subtitle="Search flights and hotels together, pick each from the same cards you book with, and submit the whole trip for approval at once."
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

      {/* results — same cards as the single-booking flow */}
      {loading && (
        <p className="mt-6 text-center text-sm text-slate-400">Searching live flights &amp; hotels…</p>
      )}

      {!loading && flights && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
            <Plane className="h-5 w-5 text-brand-dark" /> Pick your flight
            {pickFlight && <Badge color="green">Selected</Badge>}
          </h2>
          {flights.length === 0 ? (
            <Card>
              <p className="py-4 text-center text-sm text-slate-400">
                No flights found for these dates — adjust and search again.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {flights.map((opt) => (
                <FlightRow
                  key={opt.id}
                  opt={opt}
                  sig={sigFor(opt)}
                  actionLabel="Add to trip"
                  selected={pickFlight?.id === opt.id}
                  onAction={() => setPickFlight((p) => (p?.id === opt.id ? null : opt))}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!loading && hotels && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
            <Building className="h-5 w-5 text-brand-dark" /> Pick your hotel
            {pickHotel && <Badge color="green">Selected</Badge>}
          </h2>
          {hotels.length === 0 ? (
            <Card>
              <p className="py-4 text-center text-sm text-slate-400">
                No stays found for these dates — adjust and search again.
              </p>
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {hotels.map((opt) => (
                <HotelCard
                  key={opt.id}
                  opt={opt}
                  sig={sigFor(opt)}
                  actionLabel="Add to trip"
                  selected={pickHotel?.id === opt.id}
                  onAction={() => setPickHotel((p) => (p?.id === opt.id ? null : opt))}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* review — a sticky summary rail once anything is picked */}
      {anyPicked && (
        <Card className="mt-8 border-brand/30 bg-brand/5">
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900">Review your trip</h2>
          <p className="mb-3 text-xs text-slate-500">
            {dest?.label} · {dateRange(start, end)}
          </p>
          <div className="space-y-2">
            {plannedFlight && <ReviewLeg label="Flight" item={plannedFlight} />}
            {plannedHotel && <ReviewLeg label="Hotel" item={plannedHotel} />}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-brand/20 pt-3">
            <span className="text-sm font-semibold text-slate-700">Trip total</span>
            <span className="font-display text-xl font-bold text-slate-900">{money(total)}</span>
          </div>
          {!(plannedFlight && plannedHotel) && (
            <p className="mt-2 text-xs text-slate-500">
              Add the {plannedFlight ? 'hotel' : 'flight'} above to submit both legs together, or
              submit just this one.
            </p>
          )}
          <div
            className={cn(
              'mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
              allInPolicy ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            )}
          >
            <Shield className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {allInPolicy
                ? 'Everything here is in policy. Submit and your manager just confirms.'
                : 'Some of this trip is out of policy — submit it and your manager will review.'}{' '}
              Once approved, we process payment and book it automatically — you won’t need to come
              back, and you’ll get an email with the confirmation numbers.
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
