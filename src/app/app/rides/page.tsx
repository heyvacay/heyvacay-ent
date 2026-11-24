'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Button, Card, Field, Input, cn } from '@/components/app/ui';
import { CityPicker } from '@/components/app/CityPicker';
import { GroundSavings } from '@/components/app/GroundSavings';
import { money } from '@/lib/format';
import type { HotelPlace } from '@/lib/search';
import { fetchRideOptions, bookRideApi } from '@/lib/rideshareBooking';
import {
  evaluateRidePolicy,
  DEFAULT_RIDE_POLICY,
  RIDE_TIER_LABEL,
  RIDE_PROVIDER_LABEL,
  milesApart,
  type RideOption,
  type LatLng,
} from '@/lib/rideshare';
import { CarTaxiFront, Car, MapPin, Clock, ArrowRight, Check, Sparkles } from 'lucide-react';

const toLatLng = (p: HotelPlace | null): LatLng | null =>
  p && p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng, label: p.label } : null;

export default function RidesPage() {
  const { state, activeUser, bookRide } = useStore();
  const ridePolicy = state.company.setup?.ridePolicy ?? DEFAULT_RIDE_POLICY;
  const firstName = (activeUser.name ?? '').trim().split(' ')[0] || 'there';

  const [pickText, setPickText] = useState('');
  const [pick, setPick] = useState<HotelPlace | null>(null);
  const [dropText, setDropText] = useState('');
  const [drop, setDrop] = useState<HotelPlace | null>(null);
  const [phone, setPhone] = useState(activeUser.travelProfile?.phone ?? '');

  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<RideOption[] | null>(null);
  const [booking, setBooking] = useState<string | null>(null);
  const [done, setDone] = useState<null | { label: string; pending: boolean; deepLink?: string }>(null);

  const pickup = toLatLng(pick);
  const dropoff = toLatLng(drop);
  const miles = pickup && dropoff ? milesApart(pickup, dropoff) : 0;

  const search = async () => {
    if (!pickup || !dropoff) return;
    setLoading(true);
    setOptions(null);
    setDone(null);
    const opts = await fetchRideOptions(pickup, dropoff);
    setOptions(opts);
    setLoading(false);
  };

  const rows = useMemo(() => {
    if (!options) return [];
    return options
      .map((o) => {
        const { action, reason } = evaluateRidePolicy(ridePolicy, o.tier, o.fareHigh, o.provider);
        return { o, action, reason };
      })
      .sort((a, b) => (a.o.fareLow ?? 0) - (b.o.fareLow ?? 0));
  }, [options, ridePolicy]);

  // Cheapest option the traveler is actually allowed to book → "Best price".
  const bestKey = useMemo(() => {
    const allowed = rows.find((r) => r.action !== 'block');
    return allowed ? `${allowed.o.provider}:${allowed.o.classKey}` : null;
  }, [rows]);

  const doBook = async (o: RideOption, action: 'allow' | 'approve', reason?: string) => {
    if (!pickup || !dropoff) return;
    setBooking(o.classKey);
    try {
      let deepLink: string | undefined;
      let providerRef: string | undefined;
      let providerStatus: string | undefined;
      if (action === 'allow') {
        const res = await bookRideApi({
          provider: o.provider,
          classKey: o.classKey,
          productId: o.productId,
          fareId: o.fareId,
          pickup,
          dropoff,
          passenger: { firstName, phone: phone.trim() },
        });
        if (res.booked) providerRef = res.id;
        else deepLink = res.deepLink;
        providerStatus = res.status;
      }
      bookRide({
        provider: o.provider,
        classKey: o.classKey,
        label: o.label,
        action,
        pickupLabel: pickup.label ?? 'Pickup',
        dropoffLabel: dropoff.label ?? 'Destination',
        fareLow: o.fareLow,
        fareHigh: o.fareHigh,
        policyNote: reason,
        providerRef,
        providerStatus,
        deepLink,
      });
      setDone({ label: o.label, pending: action === 'approve', deepLink });
      if (deepLink) window.open(deepLink, '_blank', 'noopener');
    } finally {
      setBooking(null);
    }
  };

  const canSearch = !!pickup && !!dropoff && !loading;

  return (
    <div className="space-y-6">
      {/* ---- hero + composer ---- */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-surface to-navy-deep p-6 text-white ring-1 ring-white/10 sm:p-8">
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            {state.company.name} · ground transport
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            Grab a ride, {firstName}
          </h1>
          <p className="mt-1 max-w-lg text-sm text-white/70">
            Uber &amp; Lyft side by side, on your company&apos;s policy. We show the fare before you
            commit and keep every ride on the books.
          </p>

          {/* floating composer */}
          <div className="mt-6 rounded-2xl bg-white p-4 text-slate-900 shadow-xl ring-1 ring-black/5 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pickup">
                <CityPicker
                  value={pickText}
                  selected={!!pick}
                  onText={setPickText}
                  onPick={(p) => {
                    setPick(p);
                    setPickText(p.label);
                  }}
                  placeholder="Where from?"
                />
              </Field>
              <Field label="Destination">
                <CityPicker
                  value={dropText}
                  selected={!!drop}
                  onText={setDropText}
                  onPick={(p) => {
                    setDrop(p);
                    setDropText(p.label);
                  }}
                  placeholder="Where to?"
                />
              </Field>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Passenger mobile — for the driver">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  inputMode="tel"
                />
              </Field>
              <Button className="h-11 w-full sm:w-auto sm:px-8" disabled={!canSearch} onClick={search}>
                {loading ? 'Finding rides…' : 'Find rides'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- confirmation ---- */}
      {done && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-emerald-900 dark:text-emerald-200">
                {done.pending
                  ? `${done.label} sent for approval`
                  : done.deepLink
                    ? `${done.label} — opening the app`
                    : `${done.label} requested`}
              </p>
              <p className="mt-0.5 text-sm text-emerald-800/90 dark:text-emerald-300/90">
                {done.pending
                  ? 'A manager needs to approve this ride before it dispatches — find it under Approvals / My trips.'
                  : done.deepLink
                    ? 'Booking access isn’t connected yet, so we logged the trip and opened the provider app to finish. '
                    : 'Your driver is being dispatched — track it in the provider app. The trip is on your company books.'}
                {done.deepLink && (
                  <a href={done.deepLink} target="_blank" rel="noopener" className="font-semibold underline">
                    Open app
                  </a>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ---- loading ---- */}
      {loading && (
        <p className="py-10 text-center text-sm text-slate-400">Pricing Uber &amp; Lyft for your route…</p>
      )}

      {/* ---- results ---- */}
      {options && !loading && (
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {rows.length} ride{rows.length === 1 ? '' : 's'} available
              </h2>
              <p className="text-sm text-slate-400">
                {pick?.label?.split(',')[0]} <ArrowRight className="inline h-3.5 w-3.5" />{' '}
                {drop?.label?.split(',')[0]} · ~{miles.toFixed(1)} mi
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold',
                options.some((o) => o.live)
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
              )}
            >
              {options.some((o) => o.live) ? 'Live fares' : 'Estimated fares'}
            </span>
          </div>

          <div className="space-y-2.5">
            {rows.map(({ o, action, reason }) => {
              const key = `${o.provider}:${o.classKey}`;
              const blocked = action === 'block';
              const needsApproval = action === 'approve';
              const Icon = o.provider === 'uber' ? Car : CarTaxiFront;
              const isBest = key === bestKey;
              return (
                <div
                  key={key}
                  className={cn(
                    'relative flex items-center gap-4 rounded-2xl border bg-white p-3.5 transition dark:bg-white/5 sm:p-4',
                    blocked
                      ? 'border-slate-200 opacity-60 dark:border-white/10'
                      : isBest
                        ? 'border-brand/50 ring-1 ring-brand/20 dark:border-brand/40'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm dark:border-white/10'
                  )}
                >
                  {/* provider tile */}
                  <span
                    className={cn(
                      'grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm',
                      o.provider === 'uber' ? 'bg-black' : 'bg-[#FF00BF]'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>

                  {/* middle */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[15px] font-bold text-slate-900 dark:text-white">{o.label}</p>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
                        {RIDE_PROVIDER_LABEL[o.provider]}
                      </span>
                      {isBest && !blocked && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[11px] font-bold text-brand-dark">
                          <Sparkles className="h-3 w-3" /> Best price
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                      <span>{RIDE_TIER_LABEL[o.tier]}</span>
                      <span>· {o.seats} seats</span>
                      {o.etaMinutes != null && (
                        <span className="inline-flex items-center gap-1">
                          · <Clock className="h-3 w-3" /> {o.etaMinutes} min away
                        </span>
                      )}
                    </p>
                    {(needsApproval || blocked) && reason && (
                      <p className={cn('mt-1 text-xs font-medium', blocked ? 'text-red-600' : 'text-amber-600')}>
                        {reason}
                      </p>
                    )}
                  </div>

                  {/* right: fare + action */}
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <p className="font-display text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {o.fareLow != null
                        ? o.fareLow === o.fareHigh
                          ? money(o.fareLow)
                          : `${money(o.fareLow)}–${money(o.fareHigh ?? o.fareLow)}`
                        : '—'}
                    </p>
                    {blocked ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600 dark:bg-red-500/15">
                        Not allowed
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant={needsApproval ? 'outline' : 'primary'}
                        disabled={booking === o.classKey || (action === 'allow' && !phone.trim())}
                        onClick={() => doBook(o, action, reason)}
                      >
                        {booking === o.classKey ? 'Booking…' : needsApproval ? 'Request' : 'Book ride'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!phone.trim() && rows.some((r) => r.action === 'allow') && (
            <p className="text-center text-xs text-amber-600">
              Add a passenger mobile above to book a ride directly.
            </p>
          )}

          {/* savings context */}
          {miles > 0 && (
            <div className="pt-2">
              <GroundSavings days={1} ridesPerDay={2} />
            </div>
          )}
        </div>
      )}

      {/* ---- empty state before first search ---- */}
      {!options && !loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { Icon: MapPin, t: 'Set your route', d: 'Pickup and destination — we price both apps at once.' },
            { Icon: Sparkles, t: 'On policy', d: 'Ride classes are allowed, flagged for approval, or blocked per your rules.' },
            { Icon: Check, t: 'On the books', d: 'Every ride lands in trips, approvals and reporting automatically.' },
          ].map(({ Icon, t, d }) => (
            <Card key={t} className="bg-slate-50/60 dark:bg-white/5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand-dark">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">{t}</p>
              <p className="mt-0.5 text-xs text-slate-400">{d}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
