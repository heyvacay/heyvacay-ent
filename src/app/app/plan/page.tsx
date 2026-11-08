'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { Plane, Building, Shield, ArrowRight, Sparkles, Check } from '@/components/icons';
import { Train, Car } from 'lucide-react';
import { rewardsFor } from '@/lib/rewards';
import { FlightRow, HotelCard, type Sig } from '@/components/app/results';
import type { InventoryOption, PlannedItem, TripPlan, LiveBookingContext } from '@/lib/types';
import { splitName } from '@/lib/liveBooking';

const toISO = (d: Date) => fmtDate(d, 'yyyy-MM-dd');

export default function PlanTripPage() {
  const { state, activeUser, role, evaluatePolicies, savePlan, submitPlan, resolvePlanLive } = useStore();

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
  // Optional ground legs the traveler wants us to arrange alongside the trip.
  const [addTrain, setAddTrain] = useState(false);
  const [addCar, setAddCar] = useState(false);
  // Package flow: pick the hotel first, then the flight, then review — mirrors
  // the HeyVacay consumer package booking. 'search' before results exist.
  const [step, setStep] = useState<'search' | 'stay' | 'flight' | 'review'>('search');

  const firstName = (activeUser.name ?? '').trim().split(' ')[0] || 'there';
  const draftKey = `hv_ent_plan_draft_${state.company.id}`;

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
      setHotels(hp.options.slice(0, 6));
      // Package flow always starts on the hotel step.
      setStep('stay');
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
    if (!pDest && !pOrigin) {
      // No deep-link — restore the saved draft so a half-planned trip survives
      // navigating away and coming back.
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw) as {
            origin?: FlightPlace | null;
            originText?: string;
            dest?: HotelPlace | null;
            destText?: string;
            start?: string;
            end?: string;
            addTrain?: boolean;
            addCar?: boolean;
          };
          if (d.origin) setOrigin(d.origin);
          if (d.originText) setOriginText(d.originText);
          if (d.dest) setDest(d.dest);
          if (d.destText) setDestText(d.destText);
          if (d.start) setStart(d.start);
          if (d.end) setEnd(d.end);
          if (d.addTrain) setAddTrain(true);
          if (d.addCar) setAddCar(true);
        }
      } catch {
        /* ignore corrupt draft */
      }
      return;
    }
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

  // Persist the composer as a lightweight draft so choices are saved.
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ origin, originText, dest, destText, start, end, addTrain, addCar })
      );
    } catch {
      /* ignore */
    }
  }, [draftKey, origin, originText, dest, destText, start, end, addTrain, addCar]);

  // Flight leg carries its live payload so an approved plan can auto-ticket it.
  const flightLiveContext = (opt: InventoryOption): LiveBookingContext | undefined => {
    if (!opt.id) return undefined;
    const tp = activeUser.travelProfile ?? {};
    const { firstName, lastName } = splitName(activeUser.name);
    return {
      kind: 'flight',
      outOfferId: opt.id,
      amount: opt.price,
      currency: 'USD',
      contact: { email: activeUser.email || '', phone: (tp.phone || '').replace(/\D/g, '') },
      passengers: [
        {
          title: tp.title ?? '',
          gender: tp.gender ?? '',
          givenName: firstName,
          middleName: tp.middleName || undefined,
          familyName: lastName,
          bornOn: tp.dob ?? '',
        },
      ],
    };
  };

  const plannedFlight: PlannedItem | null = pickFlight
    ? {
        opt: pickFlight,
        startDate: start,
        endDate: end,
        ...assess(pickFlight),
        liveContext: flightLiveContext(pickFlight),
      }
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
    // Reset composer and clear the saved draft.
    setPickFlight(null);
    setPickHotel(null);
    setFlights(null);
    setHotels(null);
    setAddTrain(false);
    setAddCar(false);
    setStep('search');
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
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

      {/* ---- search hero (also the editor you return to) ---- */}
      {step === 'search' && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="bg-gradient-to-r from-brand/15 via-brand/5 to-transparent px-5 pt-5 sm:px-7 sm:pt-7">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-dark">
              <Sparkles className="h-3.5 w-3.5" /> Package trip
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              Where to, {firstName}?
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Choose your hotel first, then your flight — we bundle them into one trip and one
              approval, just like booking a HeyVacay package.
            </p>
          </div>
          <div className="px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
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
                  {loading ? 'Searching…' : 'Search hotels & flights'}
                </Button>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Add ground transportation
              </p>
              <div className="flex flex-wrap gap-3">
                <GroundToggle
                  active={addTrain}
                  onToggle={() => setAddTrain((v) => !v)}
                  Icon={Train}
                  label="Rail"
                  sub="Train between cities"
                />
                <GroundToggle
                  active={addCar}
                  onToggle={() => setAddCar((v) => !v)}
                  Icon={Car}
                  label="Rental car"
                  sub="Pick-up at destination"
                />
              </div>
              {(addTrain || addCar) && (
                <p className="mt-2 text-xs text-slate-400">
                  Our travel team arranges this with the trip and adds it to the approval.
                </p>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}

      {/* ---- trip bar + package stepper (after a search) ---- */}
      {step !== 'search' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-800 dark:text-white">
                {originText ? originText.split(',')[0] : 'Trip'} → {dest?.label.split(',')[0] ?? destText}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{dateRange(start, end)}</span>
            </div>
            <button
              onClick={() => setStep('search')}
              className="text-xs font-semibold text-brand-dark hover:underline"
            >
              Edit search
            </button>
          </div>
          <PackageStepper step={step} hasHotel={!!pickHotel} hasFlight={!!pickFlight} onJump={setStep} />
        </>
      )}

      {/* results — same cards as the single-booking flow */}
      {loading && (
        <p className="mt-6 text-center text-sm text-slate-400">
          Putting your trip together, {firstName}… searching live flights &amp; hotels.
        </p>
      )}

      {step === 'flight' && !loading && flights && (
        <section className="mt-6 pb-28">
          {/* selected-hotel recap so the package context is always visible */}
          {pickHotel && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Building className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate">
                  <span className="font-semibold text-slate-800 dark:text-white">Hotel:</span>{' '}
                  {pickHotel.title} · {money(pickHotel.price)}
                </span>
              </div>
              <button
                onClick={() => setStep('stay')}
                className="shrink-0 text-xs font-semibold text-brand-dark hover:underline"
              >
                Change
              </button>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
              <Plane className="h-5 w-5 text-brand-dark" /> Now choose your flight
            </h2>
            {flights.length > 0 && (
              <span className="text-xs text-slate-400">{flights.length} fares</span>
            )}
          </div>
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
                  actionLabel="Select flight"
                  selected={pickFlight?.id === opt.id}
                  onAction={() => setPickFlight((p) => (p?.id === opt.id ? null : opt))}
                />
              ))}
            </div>
          )}

          <StickyBar
            left={
              <span>
                <span className="text-slate-500">Trip total</span>{' '}
                <span className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {money(total)}
                </span>
              </span>
            }
          >
            <Button variant="outline" onClick={() => setStep('stay')}>
              Back
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPickFlight(null);
                setStep('review');
              }}
            >
              Skip flight
            </Button>
            <Button disabled={!pickFlight} onClick={() => setStep('review')}>
              Review trip <ArrowRight className="h-4 w-4" />
            </Button>
          </StickyBar>
        </section>
      )}

      {step === 'stay' && !loading && hotels && (
        <section className="mt-6 pb-28">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
              <Building className="h-5 w-5 text-brand-dark" /> Choose your hotel
              <span className="text-slate-400">in {dest?.label.split(',')[0] ?? destText}</span>
            </h2>
            {hotels.length > 0 && (
              <span className="text-xs text-slate-400">{hotels.length} stays</span>
            )}
          </div>
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
                  actionLabel="Select hotel"
                  selected={pickHotel?.id === opt.id}
                  onAction={() => setPickHotel((p) => (p?.id === opt.id ? null : opt))}
                />
              ))}
            </div>
          )}

          <StickyBar
            left={
              pickHotel ? (
                <span>
                  <span className="font-semibold text-slate-800 dark:text-white">{pickHotel.title}</span>{' '}
                  · {money(pickHotel.price)}
                </span>
              ) : (
                <span className="text-slate-500">Select a hotel to continue</span>
              )
            }
          >
            <Button variant="outline" onClick={() => setStep('search')}>
              Back
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPickFlight(null);
                setStep('review');
              }}
            >
              Hotel only
            </Button>
            <Button disabled={!pickHotel} onClick={() => setStep('flight')}>
              Continue to flights <ArrowRight className="h-4 w-4" />
            </Button>
          </StickyBar>
        </section>
      )}

      {/* review — final step of the package flow */}
      {step === 'review' && (
        <Card className="mt-6 border-brand/30 bg-brand/5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
              <Sparkles className="h-5 w-5 text-brand-dark" /> Review your trip
            </h2>
            <button
              onClick={() => setStep(pickFlight ? 'flight' : 'stay')}
              className="text-xs font-semibold text-brand-dark hover:underline"
            >
              ← Back
            </button>
          </div>
          {!anyPicked && (
            <p className="mb-3 text-sm text-slate-500">
              Nothing selected yet. Go back to pick a hotel and flight.
            </p>
          )}
          <p className="mb-3 text-xs text-slate-500">
            {dest?.label} · {dateRange(start, end)}
          </p>
          <div className="space-y-2">
            {plannedFlight && <ReviewLeg label="Flight" item={plannedFlight} />}
            {plannedHotel && <ReviewLeg label="Hotel" item={plannedHotel} />}
            {addTrain && <ExtraLeg label="Train" note="We'll arrange rail — added to your approval." />}
            {addCar && <ExtraLeg label="Rental car" note="We'll arrange a rental — added to your approval." />}
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
          <Button className="mt-4" onClick={submit} disabled={!anyPicked}>
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
                onResolve={resolvePlanLive}
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

/** Horizontal progress through the package flow: Hotel → Flight → Review. */
function PackageStepper({
  step,
  hasHotel,
  hasFlight,
  onJump,
}: {
  step: 'stay' | 'flight' | 'review' | 'search';
  hasHotel: boolean;
  hasFlight: boolean;
  onJump: (s: 'stay' | 'flight' | 'review') => void;
}) {
  const order = ['stay', 'flight', 'review'] as const;
  const activeIdx = order.indexOf(step as (typeof order)[number]);
  const steps: { key: (typeof order)[number]; label: string; Icon: typeof Plane; done: boolean }[] = [
    { key: 'stay', label: 'Hotel', Icon: Building, done: hasHotel },
    { key: 'flight', label: 'Flight', Icon: Plane, done: hasFlight },
    { key: 'review', label: 'Review', Icon: Sparkles, done: false },
  ];
  return (
    <div className="my-5 flex items-center">
      {steps.map((s, i) => {
        const idx = order.indexOf(s.key);
        const active = idx === activeIdx;
        const reachable = idx <= activeIdx || (s.key === 'flight' && hasHotel) || (s.key === 'review' && hasHotel);
        return (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onJump(s.key)}
              className={cn(
                'flex items-center gap-2 rounded-full px-1 py-1 transition',
                reachable ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors',
                  active
                    ? 'bg-brand text-navy ring-4 ring-brand/20'
                    : s.done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                )}
              >
                {s.done && !active ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  active
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'mx-2 h-0.5 flex-1 rounded-full',
                  idx < activeIdx ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/10'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** A sticky action bar pinned to the bottom of the viewport within the flow. */
function StickyBar({ left, children }: { left: ReactNode; children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="text-sm">{left}</div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
}


/** A serious, selectable ground-transport option (not a playful chip). */
function GroundToggle({
  active,
  onToggle,
  Icon,
  label,
  sub,
}: {
  active: boolean;
  onToggle: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'flex min-w-[12rem] flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition sm:flex-none',
        active
          ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/5'
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
          active ? 'bg-brand text-navy' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="block text-xs text-slate-400">{sub}</span>
      </span>
      <span
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors',
          active ? 'border-brand bg-brand text-navy' : 'border-slate-300 text-transparent dark:border-white/20'
        )}
      >
        <Check className="h-3 w-3" />
      </span>
    </button>
  );
}

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

function ExtraLeg({ label, note }: { label: string; note: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 dark:border-white/15 dark:bg-white/5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{note}</p>
      </div>
      <Badge color="amber">To arrange</Badge>
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
  onResolve: (id: string, approve: boolean, note?: string) => void | Promise<unknown>;
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
          : plan.status === 'needs_reconfirm'
            ? 'Needs re-confirm'
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
