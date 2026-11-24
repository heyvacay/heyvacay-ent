'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Button, Card, Field, Input, PageHeader, Badge, cn } from '@/components/app/ui';
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
import { CarTaxiFront, Car } from 'lucide-react';

const toLatLng = (p: HotelPlace | null): LatLng | null =>
  p && p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng, label: p.label } : null;

export default function RidesPage() {
  const { state, activeUser, bookRide } = useStore();
  const ridePolicy = state.company.setup?.ridePolicy ?? DEFAULT_RIDE_POLICY;

  const [pickText, setPickText] = useState('');
  const [pick, setPick] = useState<HotelPlace | null>(null);
  const [dropText, setDropText] = useState('');
  const [drop, setDrop] = useState<HotelPlace | null>(null);
  const [phone, setPhone] = useState(activeUser.travelProfile?.phone ?? '');

  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<RideOption[] | null>(null);
  const [booking, setBooking] = useState<string | null>(null); // classKey being booked
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

  const doBook = async (o: RideOption, action: 'allow' | 'approve', reason?: string) => {
    if (!pickup || !dropoff) return;
    setBooking(o.classKey);
    try {
      let deepLink: string | undefined;
      let providerRef: string | undefined;
      let providerStatus: string | undefined;
      // Only dispatch the ride now when it's allowed outright; approval-required
      // rides are recorded as pending and dispatched after a manager approves.
      if (action === 'allow') {
        const res = await bookRideApi({
          provider: o.provider,
          classKey: o.classKey,
          productId: o.productId,
          fareId: o.fareId,
          pickup,
          dropoff,
          passenger: {
            firstName: (activeUser.name ?? '').split(' ')[0],
            phone: phone.trim(),
          },
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

  return (
    <div>
      <PageHeader
        title="Book a ride"
        subtitle="Uber & Lyft, on your company's policy. Prices are estimates until a ride is confirmed."
      />

      {/* composer */}
      <Card>
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
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Passenger mobile (for the driver)">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              inputMode="tel"
            />
          </Field>
          <div className="flex items-end">
            <Button className="w-full" disabled={!pickup || !dropoff || loading} onClick={search}>
              {loading ? 'Finding rides…' : 'Find rides'}
            </Button>
          </div>
        </div>
      </Card>

      {done && (
        <Card className="mt-4 border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="font-display text-base font-bold text-emerald-800 dark:text-emerald-300">
            {done.pending
              ? `${done.label} sent for approval`
              : done.deepLink
                ? `${done.label} ready — opening the app`
                : `${done.label} requested`}
          </p>
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300/90">
            {done.pending
              ? 'A manager needs to approve this ride before it dispatches. You can see it in My trips / Approvals.'
              : done.deepLink
                ? 'Booking access isn’t connected yet, so we recorded the trip and opened the provider app to finish. '
                : 'Your driver is being dispatched. Track it in the provider app; the trip is logged to your company.'}
            {done.deepLink && (
              <a href={done.deepLink} target="_blank" rel="noopener" className="font-semibold underline">
                Open app
              </a>
            )}
          </p>
        </Card>
      )}

      {/* results */}
      {options && (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {rows.length} ride option{rows.length === 1 ? '' : 's'}
            </h2>
            <span className="text-xs text-slate-400">
              {options.some((o) => o.live) ? 'Live fares' : 'Estimated fares'} · ~{miles.toFixed(1)} mi
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {rows.map(({ o, action, reason }) => {
              const blocked = action === 'block';
              const needsApproval = action === 'approve';
              const Icon = o.provider === 'uber' ? Car : CarTaxiFront;
              return (
                <Card key={`${o.provider}:${o.classKey}`} className={cn(blocked && 'opacity-60')}>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                        o.provider === 'uber' ? 'bg-black text-white' : 'bg-[#FF00BF] text-white'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {o.label}
                        <Badge color="slate">{RIDE_PROVIDER_LABEL[o.provider]}</Badge>
                        <span className="text-xs font-normal text-slate-400">
                          {RIDE_TIER_LABEL[o.tier]} · {o.seats} seats
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {o.etaMinutes != null ? `~${o.etaMinutes} min away · ` : ''}
                        {o.fareLow != null
                          ? o.fareLow === o.fareHigh
                            ? money(o.fareLow)
                            : `${money(o.fareLow)}–${money(o.fareHigh ?? o.fareLow)}`
                          : 'Fare at pickup'}
                      </p>
                      {(needsApproval || blocked) && reason && (
                        <p className={cn('mt-0.5 text-xs font-medium', blocked ? 'text-red-600' : 'text-amber-600')}>
                          {reason}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {blocked ? (
                        <Badge color="red">Not allowed</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant={needsApproval ? 'outline' : 'primary'}
                          disabled={booking === o.classKey || (action === 'allow' && !phone.trim())}
                          onClick={() => doBook(o, action, reason)}
                        >
                          {booking === o.classKey
                            ? 'Booking…'
                            : needsApproval
                              ? 'Request'
                              : 'Book'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* savings context */}
          {miles > 0 && (
            <div className="mt-6">
              <GroundSavings days={1} ridesPerDay={2} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
