'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useEvents } from '@/lib/eventsStore';
import { Button, Card, Field, Input, cn } from '@/components/app/ui';
import { HotelAllowPicker, type AllowHotel } from '@/components/app/HotelAllowPicker';
import { placesHotels, type HotelPlace } from '@/lib/search';
import { HvRangeField } from '@/components/datepicker/HvDatePicker';
import { format as fmtDate, parseISO } from 'date-fns';
import { addDays, todayISO, shortDate, dateRange, milesBetween, money } from '@/lib/format';
import { sendEmail } from '@/lib/email';
import { Calendar, MapPin, Users, Plane, Check, Sparkles, Wallet } from '@/components/icons';
import {
  ROOM_TIERS,
  roomTierRank,
  dinnerScheduleOptions,
  type OverTierAction,
  type RoomTier,
} from '@/lib/events';
import {
  estimateEventSpend,
  budgetGuidance,
  smartPick,
} from '@/lib/eventPlanning';

const STEPS = [
  { key: 'basics', title: 'The basics', sub: 'Name, city and dates' },
  { key: 'who', title: "Who's coming", sub: 'Pick the attendees' },
  { key: 'hotels', title: 'Allowed hotels', sub: 'Pin the properties' },
  { key: 'flights', title: 'Allowed flights', sub: 'Optional routes' },
  { key: 'dinner', title: 'Group dinner', sub: 'Plan it now or later' },
  { key: 'review', title: 'Review', sub: 'Create the event' },
] as const;

export default function NewEventPage() {
  const { state, activeUser, role } = useStore();
  const { createEvent } = useEvents();
  const router = useRouter();
  const params = useSearchParams();

  const toISO = (d: Date) => fmtDate(d, 'yyyy-MM-dd');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [cityPlace, setCityPlace] = useState<HotelPlace | null>(null);
  const [start, setStart] = useState(params.get('start') || addDays(todayISO(), 21));
  const [end, setEnd] = useState(params.get('end') || addDays(todayISO(), 23));
  const activeUsers = state.users.filter((u) => u.status === 'active');
  const [attendeeIds, setAttendeeIds] = useState<string[]>(activeUsers.map((u) => u.id));
  const [allowHotelList, setAllowHotelList] = useState<AllowHotel[]>([]);
  const [whitelistOnly, setWhitelistOnly] = useState(false);
  const [routeText, setRouteText] = useState('');
  const [routes, setRoutes] = useState<string[]>([]);
  // Room-tier allow-list + budget.
  const [roomTierBase, setRoomTierBase] = useState<RoomTier>('Standard');
  const [overAction, setOverAction] = useState<OverTierAction>('manager');
  const [positionRules, setPositionRules] = useState<{ position: string; maxTier: RoomTier }[]>([]);
  const [budgetOn, setBudgetOn] = useState(false);
  const [budgetAmt, setBudgetAmt] = useState(50000);
  const [smartPlanning, setSmartPlanning] = useState(false);
  // Group dinner: start now, schedule for later, or skip.
  const [dinnerMode, setDinnerMode] = useState<'now' | 'later' | 'none'>('now');
  const [dinnerWhen, setDinnerWhen] = useState('');

  // Dinner "later" schedule options with enough lead time, computed from the
  // trip's start date. 1 week is the baseline; 2 weeks / 1 month appear only
  // when the trip is far enough out.
  const dinnerOptions = dinnerScheduleOptions(start, todayISO());
  // Keep the chosen "later" date valid as dates/options change.
  useEffect(() => {
    if (dinnerMode !== 'later') return;
    if (!dinnerOptions.some((o) => o.date === dinnerWhen)) {
      setDinnerWhen(dinnerOptions[dinnerOptions.length - 1]?.date ?? '');
    }
  }, [dinnerMode, dinnerOptions, dinnerWhen]);

  if (role !== 'admin' && role !== 'booker') {
    return (
      <div>
        <Link href="/app/events" className="text-sm font-medium text-brand-dark hover:underline">
          ← All events
        </Link>
        <Card className="mt-4">
          <p className="text-sm text-slate-500">Only admins and bookers can create events.</p>
        </Card>
      </div>
    );
  }

  const dStart = start ? parseISO(start) : undefined;
  const dEnd = end ? parseISO(end) : undefined;
  const basicsValid = name.trim().length > 0 && city.trim().length > 0 && !!start && !!end;

  // ---- live cost estimate for the allow-list + headcount ----
  const selectedAttendees = activeUsers.filter((u) => attendeeIds.includes(u.id));
  const nights = Math.max(
    1,
    dStart && dEnd ? Math.round((dEnd.getTime() - dStart.getTime()) / 86400000) : 1
  );
  const evLat = cityPlace?.lat;
  const evLng = cityPlace?.lng;
  // Someone needs a hotel if their home is >50mi away (or unknown).
  const hotelHeadcount = selectedAttendees.filter((u) => {
    if (evLat == null || evLng == null || u.homeLat == null || u.homeLng == null) return true;
    return milesBetween(u.homeLat, u.homeLng, evLat, evLng) > 50;
  }).length;
  const flightHeadcount = hotelHeadcount; // flying in ≈ needing a hotel
  const estInput = { hotelHeadcount, flightHeadcount, nights, tier: roomTierBase };
  const estimate = estimateEventSpend(estInput);
  const guidance = budgetOn ? budgetGuidance(estimate, estInput, budgetAmt) : null;
  const smart = budgetOn && smartPlanning ? smartPick(estInput, budgetAmt) : null;
  // Distinct job titles among attendees, for per-position allowances.
  const positions = Array.from(
    new Set(selectedAttendees.map((u) => u.title).filter(Boolean))
  ) as string[];
  const addPositionRule = () => {
    const next = positions.find((p) => !positionRules.some((r) => r.position === p));
    if (next) setPositionRules([...positionRules, { position: next, maxTier: roomTierBase }]);
  };

  const toggleAttendee = (id: string) =>
    setAttendeeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const addRoute = () => {
    const r = routeText.trim().toUpperCase().replace(/\s*-\s*|\s+TO\s+/i, '→');
    if (r && !routes.includes(r)) setRoutes([...routes, r]);
    setRouteText('');
  };

  const create = () => {
    const attendees = activeUsers
      .filter((u) => attendeeIds.includes(u.id))
      .map((u) => ({ userId: u.id, name: u.name }));
    // Always include the host.
    if (!attendees.some((a) => a.userId === activeUser.id))
      attendees.push({ userId: activeUser.id, name: activeUser.name });
    const ev = createEvent({
      name: name.trim(),
      city: city.trim(),
      startDate: start,
      endDate: end,
      hostId: activeUser.id,
      hostName: activeUser.name,
      allowHotels: allowHotelList.map((h) => h.name),
      allowHotelList,
      whitelistOnly: whitelistOnly && allowHotelList.length > 0,
      allowFlights: routes,
      attendees,
      regionId: cityPlace?.regionId,
      lat: cityPlace?.lat,
      lng: cityPlace?.lng,
      roomTierPolicy: {
        base: smart ? smart.tier : roomTierBase,
        byPosition: positionRules,
        overAction,
      },
      budget: budgetOn ? budgetAmt : undefined,
      smartPlanning: budgetOn && smartPlanning,
      dinnerPlanMode: dinnerMode,
      dinnerPlanAt: dinnerMode === 'later' ? dinnerWhen || undefined : undefined,
    });
    // Let everyone who was added know (no-ops without an email provider key).
    activeUsers
      .filter((u) => attendeeIds.includes(u.id) && u.id !== activeUser.id && u.email)
      .forEach((u) =>
        sendEmail('eventAdded', u.email, {
          name: u.name,
          event: name.trim(),
          city: city.trim(),
          dates: dateRange(start, end),
          host: activeUser.name,
        })
      );
    router.push(`/app/events/${ev.id}`);
  };

  const canNext =
    (step === 0 && basicsValid) ||
    (step === 1 && attendeeIds.length > 0) ||
    step >= 2;

  return (
    <div className="pb-10">
      <Link href="/app/events" className="text-sm font-medium text-brand-dark hover:underline">
        ← All events
      </Link>

      {/* hero */}
      <section className="relative mt-3 overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-surface to-navy-deep p-6 text-white ring-1 ring-white/10 sm:p-8">
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">New event</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">
            {name.trim() || 'Plan a company trip'}
          </h1>
          <p className="mt-1 text-sm text-mist/80">
            Set the travel it allows, who&apos;s invited, and let everyone coordinate — chat and
            group dinner included.
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* step rail */}
        <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.key}>
                <button
                  onClick={() => i <= step && setStep(i)}
                  disabled={i > step}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    current ? 'bg-brand/10 ring-1 ring-brand/25' : 'hover:bg-slate-100',
                    i > step && 'opacity-50'
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                      current
                        ? 'bg-brand text-navy-deep'
                        : done
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{s.title}</span>
                    <span className="hidden text-xs text-slate-400 lg:block">{s.sub}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* step body */}
        <Card className="min-h-[320px]">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-slate-900">The basics</h2>
              <Field label="Event name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Austin Q4 Offsite"
                  autoFocus
                />
              </Field>
              <Field label="City" hint="Pick a city from search — event-only booking is locked to it.">
                <CityPicker
                  value={city}
                  selected={!!cityPlace}
                  onText={(v) => {
                    setCity(v);
                    setCityPlace(null);
                  }}
                  onPick={(p) => {
                    setCity(p.label);
                    setCityPlace(p);
                  }}
                />
                {cityPlace && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Check className="h-3.5 w-3.5" /> {cityPlace.label} selected — booking for this
                    event is anchored here
                  </p>
                )}
              </Field>
              <Field label="Dates">
                <HvRangeField
                  value={{ from: dStart, to: dEnd }}
                  onChange={(r) => {
                    if (r?.from) setStart(toISO(r.from));
                    if (r?.to) setEnd(toISO(r.to));
                  }}
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900">Who&apos;s coming</h2>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => setAttendeeIds(activeUsers.map((u) => u.id))}
                    className="font-medium text-brand-dark hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setAttendeeIds([activeUser.id])}
                    className="font-medium text-slate-400 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {activeUsers.map((u) => {
                  const on = attendeeIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleAttendee(u.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                        on ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {u.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {u.name}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {u.title} · {u.department}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'grid h-5 w-5 place-items-center rounded-md border',
                          on ? 'border-brand bg-brand text-navy-deep' : 'border-slate-300'
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400">{attendeeIds.length} selected</p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-slate-900">Allowed hotels</h2>
              <p className="text-sm text-slate-500">
                Search real properties and add them. In event-only booking these are the only hotels
                shown — and they book without approval, even if out of policy.
              </p>
              <HotelAllowPicker value={allowHotelList} onChange={setAllowHotelList} />
              <label
                className={cn(
                  'mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                  whitelistOnly ? 'border-brand bg-brand/5' : 'border-slate-200',
                  allowHotelList.length === 0 && 'pointer-events-none opacity-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={whitelistOnly}
                  disabled={allowHotelList.length === 0}
                  onChange={(e) => setWhitelistOnly(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Only allow the hotels listed above
                  </span>
                  <span className="block text-xs text-slate-400">
                    Travelers booking for this event can only pick from the allow-list — other
                    hotels won&apos;t be searchable. Leave off to let them also search in-policy
                    hotels in {city.trim() || 'the event city'}.
                  </span>
                </span>
              </label>

              {/* room-tier allow-list */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">Room-type allow-list</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Everyone may book this tier <span className="font-medium">or lower</span>. Give
                  senior roles a higher ceiling; anything above a person&apos;s tier is handled by
                  the rule below.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Base room tier (everyone)">
                    <select
                      value={roomTierBase}
                      onChange={(e) => setRoomTierBase(e.target.value as RoomTier)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand"
                    >
                      {ROOM_TIERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="If someone books higher">
                    <select
                      value={overAction}
                      onChange={(e) => setOverAction(e.target.value as OverTierAction)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand"
                    >
                      <option value="block">Block it</option>
                      <option value="manager">Require manager approval</option>
                      <option value="host">Require event-host approval</option>
                    </select>
                  </Field>
                </div>

                {/* per-position allowances */}
                {positionRules.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {positionRules.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <select
                          value={r.position}
                          onChange={(e) =>
                            setPositionRules((rs) =>
                              rs.map((x, idx) => (idx === i ? { ...x, position: e.target.value } : x))
                            )
                          }
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-brand"
                        >
                          {positions.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-slate-400">up to</span>
                        <select
                          value={r.maxTier}
                          onChange={(e) =>
                            setPositionRules((rs) =>
                              rs.map((x, idx) =>
                                idx === i ? { ...x, maxTier: e.target.value as RoomTier } : x
                              )
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-brand"
                        >
                          {ROOM_TIERS.filter((t) => roomTierRank(t) >= roomTierRank(roomTierBase)).map(
                            (t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            )
                          )}
                        </select>
                        <button
                          onClick={() => setPositionRules((rs) => rs.filter((_, idx) => idx !== i))}
                          className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {positions.length > positionRules.length && (
                  <button
                    onClick={addPositionRule}
                    className="mt-2 text-sm font-semibold text-brand-dark hover:underline"
                  >
                    + Allow a position a higher tier
                  </button>
                )}
              </div>

              {/* live spend estimate + budget */}
              <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <Sparkles className="h-4 w-4 text-brand-dark" /> Estimated event spend
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <Est label="Hotels" value={money(estimate.hotel)} />
                  <Est label="Flights" value={money(estimate.flights)} />
                  <Est label="Total" value={money(estimate.total)} highlight />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {hotelHeadcount} traveler{hotelHeadcount === 1 ? '' : 's'} needing a hotel ·{' '}
                  {nights} night{nights === 1 ? '' : 's'} · {roomTierBase} ·{' '}
                  {money(estimate.nightly)}/night. Reflects live market rates for the city once the
                  rates API is connected.
                </p>

                <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-brand/20 pt-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={budgetOn}
                    onChange={(e) => setBudgetOn(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <Wallet className="h-4 w-4 text-brand-dark" /> We have a budget for this event
                </label>
                {budgetOn && (
                  <div className="mt-3 space-y-3">
                    <Field label="Event budget (total, USD)">
                      <Input
                        type="number"
                        value={budgetAmt}
                        onChange={(e) => setBudgetAmt(Number(e.target.value) || 0)}
                      />
                    </Field>
                    {guidance && guidance.over ? (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                        <p className="font-semibold text-amber-800">
                          About {money(guidance.delta)} over budget.
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-700">
                          {guidance.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      guidance && (
                        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                          Within budget — about {money(-guidance.delta)} to spare.
                        </p>
                      )
                    )}
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={smartPlanning}
                        onChange={(e) => setSmartPlanning(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                      />
                      <span>
                        <span className="font-semibold">Smart planning</span> — let HeyVacay pick the
                        best room tier that fits the budget.
                      </span>
                    </label>
                    {smart && (
                      <p
                        className={cn(
                          'rounded-lg px-3 py-2 text-sm',
                          smart.stillOver
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-brand/10 text-brand-dark'
                        )}
                      >
                        {smart.stillOver
                          ? `Even ${smart.tier} rooms (${money(smart.est.total)}) exceed the budget — raise the budget or trim the guest list / nights.`
                          : `Smart planning recommends ${smart.tier} rooms (~${money(smart.nightly)}/night) → ${money(smart.est.total)} total. The event will target hotels around this nightly rate.`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-slate-900">Allowed flights</h2>
              <p className="text-sm text-slate-500">
                Optional. Add routes like <span className="font-medium">SFO→AUS</span>. Leave empty
                for no flight restriction.
              </p>
              <div className="flex gap-2">
                <Input
                  value={routeText}
                  onChange={(e) => setRouteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRoute())}
                  placeholder="ex: SFO-AUS"
                />
                <Button variant="outline" onClick={addRoute}>
                  Add
                </Button>
              </div>
              {routes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {routes.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-dark"
                    >
                      <Plane className="h-3 w-3" /> {r}
                      <button
                        onClick={() => setRoutes(routes.filter((x) => x !== r))}
                        className="ml-0.5 text-brand-dark/60 hover:text-brand-dark"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Want a group dinner on this trip?
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  HeyVacay runs it for you: collect RSVPs, let the group vote on a cuisine and a
                  spot, then auto-book the winner on OpenTable. You choose when it kicks off.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['now', 'Start planning now', 'Send RSVP requests to everyone as soon as the event is created.'],
                    ['later', 'Schedule for later', 'Kick it off automatically closer to the trip, when people can commit.'],
                    ['none', 'No dinner', 'Skip the group dinner for this trip. You can still start one anytime.'],
                  ] as ['now' | 'later' | 'none', string, string][]
                ).map(([val, title, desc]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDinnerMode(val)}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition',
                      dinnerMode === val
                        ? 'border-brand bg-brand/8 ring-1 ring-brand/40'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      {dinnerMode === val && <Check className="h-4 w-4 text-brand-dark" />}
                      {title}
                    </span>
                    <span className="text-xs text-slate-500">{desc}</span>
                  </button>
                ))}
              </div>

              {dinnerMode === 'now' && (
                <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  Planning starts right away — everyone gets an RSVP request, with the dinner
                  pencilled in for your first night ({shortDate(start)}, 7:00 PM). You can change the
                  date and time on the event&apos;s Dinner tab.
                </p>
              )}

              {dinnerMode === 'later' && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="mb-1 text-sm font-semibold text-slate-800">When should it start?</p>
                  <p className="mb-3 text-xs text-slate-500">
                    We&apos;ll automatically send RSVP requests on this day — far enough ahead to
                    plan, close enough that people know their schedule.
                  </p>
                  {dinnerOptions.length === 0 ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      This trip is too soon to schedule ahead — pick “Start planning now” instead.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {dinnerOptions.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setDinnerWhen(o.date)}
                          className={cn(
                            'rounded-xl border p-3 text-left transition',
                            dinnerWhen === o.date
                              ? 'border-brand bg-brand/8 ring-1 ring-brand/40'
                              : 'border-slate-200 hover:border-slate-300'
                          )}
                        >
                          <span className="block text-sm font-semibold text-slate-800">{o.label}</span>
                          <span className="block text-xs text-slate-500">Starts {shortDate(o.date)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-slate-900">Review &amp; create</h2>
              <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                <Row icon={<Calendar className="h-4 w-4" />} k={name.trim() || 'Untitled event'} v={`${shortDate(start)}–${shortDate(end)}`} />
                <Row icon={<MapPin className="h-4 w-4" />} k="City" v={city.trim() || '—'} />
                <Row icon={<Users className="h-4 w-4" />} k="Attendees" v={`${attendeeIds.length} people`} />
                <Row
                  icon={<MapPin className="h-4 w-4" />}
                  k="Allowed hotels"
                  v={allowHotelList.length ? `${allowHotelList.length} pinned` : 'No restriction'}
                />
                <Row
                  icon={<Plane className="h-4 w-4" />}
                  k="Allowed flights"
                  v={routes.length ? routes.join(', ') : 'No restriction'}
                />
                <Row
                  icon={<Users className="h-4 w-4" />}
                  k="Group dinner"
                  v={
                    dinnerMode === 'now'
                      ? 'Starts now'
                      : dinnerMode === 'later'
                        ? `Starts ${shortDate(dinnerWhen || start)}`
                        : 'Not planned'
                  }
                />
              </div>
              {allowHotelList.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {allowHotelList.map((h) => (
                    <span
                      key={h.hid}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                    >
                      <Check className="h-3 w-3 text-brand-dark" /> {h.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* nav */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Continue
              </Button>
            ) : (
              <Button onClick={create} disabled={!basicsValid}>
                Create event
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CityPicker({
  value,
  selected,
  onText,
  onPick,
}: {
  value: string;
  selected?: boolean;
  onText: (v: string) => void;
  onPick: (p: HotelPlace) => void;
}) {
  const [items, setItems] = useState<HotelPlace[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const places = await placesHotels(term);
        if (live) setItems(places.filter((p) => p.type === 'region').slice(0, 6));
      } catch {
        if (live) setItems([]);
      }
    }, 240);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search a city…"
          autoComplete="off"
          className={selected ? 'border-emerald-300 bg-emerald-50/40 pr-9' : undefined}
        />
        {selected && (
          <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
        )}
      </div>
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((p, i) => (
            <li key={`${p.regionId}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(p);
                  setItems([]);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">{p.label}</span>
                  {p.sub && <span className="block truncate text-xs text-slate-400">{p.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Est({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-2',
        highlight ? 'border-brand/40 bg-white' : 'border-slate-200 bg-white/70'
      )}
    >
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className={cn('mt-0.5 font-display text-base font-bold', highlight ? 'text-brand-dark' : 'text-slate-800')}>
        {value}
      </p>
    </div>
  );
}

function Row({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 font-medium text-slate-700">
        <span className="text-brand-dark">{icon}</span>
        {k}
      </span>
      <span className="text-right text-slate-500">{v}</span>
    </div>
  );
}
