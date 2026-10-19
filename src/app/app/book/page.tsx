'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Button,
  Field,
  Input,
  PageHeader,
  Select,
  Card,
  EmptyState,
  cn,
} from '@/components/app/ui';
import { money, num, todayISO, addDays } from '@/lib/format';
import { rewardsFor } from '@/lib/rewards';
import {
  searchFlights,
  searchHotels,
  placesFlights,
  placesHotels,
  type FlightPlace,
  type HotelPlace,
} from '@/lib/search';
import { Plane, Receipt, Check, Shield, Gift, Building, MapPin } from '@/components/icons';
import type { BookingType, InventoryOption } from '@/lib/types';
import type { PolicyFlag } from '@/lib/store';

/* ---------------- helpers ---------------- */

function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function durLabel(mins?: number): string {
  if (mins == null) return '';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function stopsLabel(stops?: number): string {
  if (!stops || stops <= 0) return 'Direct';
  return stops === 1 ? '1 stop' : `${stops} stops`;
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-slate-300 border-t-brand',
        className ?? 'h-4 w-4'
      )}
    />
  );
}

function Stars({ n = 0 }: { n?: number }) {
  return (
    <span className="text-sm leading-none">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? 'text-amber-400' : 'text-slate-200'}>
          ★
        </span>
      ))}
    </span>
  );
}

/** The enterprise overlay every result carries: policy + savings + points. */
function Signals({
  flags,
  savings,
  points,
}: {
  flags: PolicyFlag[];
  savings: number;
  points: number;
}) {
  const needsApproval = flags.some(
    (f) => f.policy.action === 'approve' || f.policy.action === 'block'
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      {flags.length === 0 ? (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" /> In policy
        </span>
      ) : needsApproval ? (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Shield className="h-3.5 w-3.5" /> Needs approval
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Shield className="h-3.5 w-3.5" /> Policy note
        </span>
      )}
      {savings > 0 && (
        <span className="font-semibold text-emerald-600">
          Saves company {money(savings)}
        </span>
      )}
      <span className="inline-flex items-center gap-1 font-semibold text-brand-dark">
        <Gift className="h-3.5 w-3.5" /> +{num(points)} pts
      </span>
    </div>
  );
}

/** Hotel photo with a branded fallback tile if the image can't load. */
function HotelImage({ src, alt }: { src?: string; alt: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className="relative h-44 w-full bg-gradient-to-br from-slate-200 to-brand/25">
      <span className="absolute inset-0 grid place-items-center text-slate-400">
        <Building className="h-8 w-8" />
      </span>
      {ok && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

function AirlineBadge({ iata }: { iata?: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand-dark">
      {iata ?? <Plane className="h-4 w-4" />}
    </span>
  );
}

/* ---------------- typeahead field ---------------- */

interface Suggestion {
  key: string;
  label: string;
  sub?: string;
}

/**
 * Debounced destination/airport picker. Fetches suggestions from the backend
 * (via our proxy) so the code/region id we send to search is one the provider
 * actually recognizes — this is what makes "search any city" real.
 */
function PlaceField<T extends Suggestion>({
  label,
  placeholder,
  value,
  onChange,
  fetcher,
  onPick,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  fetcher: (q: string) => Promise<T[]>;
  onPick: (s: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the latest fetcher in a ref so the debounce effect depends only on the
  // query text — the fetcher is an inline arrow that changes identity every
  // render, and the effect itself flips `loading`, so depending on it would
  // loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetcherRef.current(q);
        if (live) setItems(res);
      } finally {
        if (live) setLoading(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <Field label={label}>
      <div ref={boxRef} className="relative">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner />
          </span>
        )}
        {open && items.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((it) => (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(it);
                    onChange(it.label);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800">{it.label}</span>
                    {it.sub && (
                      <span className="block truncate text-xs text-slate-400">{it.sub}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

/* ---------------- page ---------------- */

type FlightSug = FlightPlace & Suggestion;
type HotelSug = HotelPlace & Suggestion;

export default function BookPage() {
  const { state, role, activeUser, evaluatePolicies, book } = useStore();
  const canBookForOthers = role === 'admin' || role === 'booker';

  const [type, setType] = useState<BookingType>('flight');

  // flight inputs
  const [originText, setOriginText] = useState('');
  const [origin, setOrigin] = useState<FlightPlace | null>(null);
  const [destText, setDestText] = useState('');
  const [dest, setDest] = useState<FlightPlace | null>(null);
  const [roundTrip, setRoundTrip] = useState(true);
  const [cabin, setCabin] = useState('economy');

  // hotel inputs
  const [hotelText, setHotelText] = useState('');
  const [hotelPlace, setHotelPlace] = useState<HotelPlace | null>(null);

  // shared
  const [start, setStart] = useState(addDays(todayISO(), 14));
  const [end, setEnd] = useState(addDays(todayISO(), 17));
  const [travelerId, setTravelerId] = useState(activeUser.id);

  const [results, setResults] = useState<InventoryOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    opt: InventoryOption;
    pending: boolean;
    points: number;
  } | null>(null);

  const switchType = (t: BookingType) => {
    setType(t);
    setResults(null);
    setError(null);
  };

  const sig = (opt: InventoryOption) => {
    const flags = evaluatePolicies(opt, start);
    const { savings, points } = rewardsFor(opt);
    const pending = flags.some(
      (f) => f.policy.action === 'approve' || f.policy.action === 'block'
    );
    return { flags, savings, points, pending };
  };

  const runSearch = async () => {
    setError(null);
    setConfirmed(null);
    setLoading(true);
    setResults(null);
    try {
      if (type === 'flight') {
        // Resolve typed text to an airport if the traveler didn't pick one.
        let o = origin;
        let d = dest;
        if (!o && originText.trim()) o = (await placesFlights(originText))[0] ?? null;
        if (!d && destText.trim()) d = (await placesFlights(destText))[0] ?? null;
        if (!o || !d) throw new Error('Pick an origin and destination airport to search.');
        setOrigin(o);
        setDest(d);
        const r = await searchFlights({
          origin: o.code,
          destination: d.code,
          departDate: start,
          returnDate: roundTrip ? end : undefined,
          cabinClass: cabin,
          adults: 1,
        });
        setResults(r);
      } else {
        let p = hotelPlace;
        if (!p && hotelText.trim()) p = (await placesHotels(hotelText))[0] ?? null;
        if (!p) throw new Error('Pick a destination city to search.');
        setHotelPlace(p);
        if (new Date(end) <= new Date(start))
          throw new Error('Check-out must be after check-in.');
        const r = await searchHotels({
          regionId: p.regionId,
          checkin: start,
          checkout: end,
          adults: 1,
        });
        setResults(r);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirm = (opt: InventoryOption) => {
    const { pending, points } = sig(opt);
    book({ opt, travelerId, startDate: start, endDate: end });
    setConfirmed({ opt, pending, points });
    setResults(null);
  };

  /* ----- confirmation ----- */
  if (confirmed) {
    const savings = rewardsFor(confirmed.opt).savings;
    return (
      <div>
        <PageHeader title="Booking" subtitle="You just booked smart." />
        <Card className="mx-auto max-w-xl text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">
            {confirmed.pending ? 'Sent for approval' : 'Trip confirmed'}
          </h2>
          <p className="mt-1 text-slate-500">
            {confirmed.opt.title} · {confirmed.opt.detail}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">Price</p>
              <p className="font-display text-lg font-bold text-slate-900">
                {money(confirmed.opt.price)}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs text-emerald-600">Saved</p>
              <p className="font-display text-lg font-bold text-emerald-700">
                {money(savings)}
              </p>
            </div>
            <div className="rounded-xl bg-brand/10 p-4">
              <p className="text-xs text-brand-dark">Points</p>
              <p className="font-display text-lg font-bold text-brand-dark">
                {confirmed.pending ? '—' : `+${num(confirmed.points)}`}
              </p>
            </div>
          </div>
          {confirmed.pending && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              This trip needs manager approval under your travel policy. Points
              land once it&apos;s approved.
            </p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Button href="/app/trips">View my trips</Button>
            <Button variant="outline" onClick={() => setConfirmed(null)}>
              Book another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ----- search + results ----- */
  return (
    <div>
      <PageHeader
        title="Book travel"
        subtitle="Same live inventory as HeyVacay — always below market. Every result shows if it's in policy, what it saves, and the points you earn."
      />

      {/* search bar */}
      <Card>
        <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
          {(['flight', 'hotel'] as BookingType[]).map((t) => (
            <button
              key={t}
              onClick={() => switchType(t)}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition-colors',
                type === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              )}
            >
              {t === 'flight' ? (
                <Plane className="h-4 w-4" />
              ) : (
                <Receipt className="h-4 w-4" />
              )}
              {t === 'flight' ? 'Flights' : 'Hotels'}
            </button>
          ))}
        </div>

        {type === 'flight' ? (
          <>
            <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
              {(
                [
                  ['round', 'Round trip'],
                  ['oneway', 'One way'],
                ] as const
              ).map(([v, lbl]) => (
                <button
                  key={v}
                  onClick={() => setRoundTrip(v === 'round')}
                  className={cn(
                    'rounded-md px-3 py-1 font-semibold transition-colors',
                    roundTrip === (v === 'round')
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500'
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PlaceField<FlightSug>
                label="From"
                placeholder="City or airport"
                value={originText}
                onChange={(v) => {
                  setOriginText(v);
                  setOrigin(null);
                }}
                fetcher={async (q) =>
                  (await placesFlights(q)).map((p) => ({ ...p, key: p.code }))
                }
                onPick={(s) => setOrigin(s)}
              />
              <PlaceField<FlightSug>
                label="To"
                placeholder="City or airport"
                value={destText}
                onChange={(v) => {
                  setDestText(v);
                  setDest(null);
                }}
                fetcher={async (q) =>
                  (await placesFlights(q)).map((p) => ({ ...p, key: p.code }))
                }
                onPick={(s) => setDest(s)}
              />
              <Field label="Depart">
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="Return">
                <Input
                  type="date"
                  value={end}
                  disabled={!roundTrip}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
              <Field label="Cabin">
                <Select value={cabin} onChange={(e) => setCabin(e.target.value)}>
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium economy</option>
                  <option value="business">Business</option>
                  <option value="first">First</option>
                </Select>
              </Field>
              <Field label="Traveler">
                {canBookForOthers ? (
                  <Select
                    value={travelerId}
                    onChange={(e) => setTravelerId(e.target.value)}
                  >
                    {state.users
                      .filter((u) => u.status === 'active')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <Input value={activeUser.name} disabled />
                )}
              </Field>
            </div>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PlaceField<HotelSug>
              label="Destination"
              placeholder="City"
              value={hotelText}
              onChange={(v) => {
                setHotelText(v);
                setHotelPlace(null);
              }}
              fetcher={async (q) =>
                (await placesHotels(q)).map((p) => ({ ...p, key: String(p.regionId) }))
              }
              onPick={(s) => setHotelPlace(s)}
            />
            <Field label="Check in">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Check out">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Field label="Guest">
              {canBookForOthers ? (
                <Select
                  value={travelerId}
                  onChange={(e) => setTravelerId(e.target.value)}
                >
                  {state.users
                    .filter((u) => u.status === 'active')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </Select>
              ) : (
                <Input value={activeUser.name} disabled />
              )}
            </Field>
          </div>
        )}

        <Button className="mt-4" onClick={runSearch} disabled={loading}>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4 border-white/40 border-t-white" />
              Searching…
            </span>
          ) : (
            `Search ${type === 'flight' ? 'flights' : 'hotels'}`
          )}
        </Button>
      </Card>

      {error && (
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-700">{error}</p>
        </Card>
      )}

      {/* loading skeleton */}
      {loading && (
        <div className="mt-6 grid place-items-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm">Pulling live {type === 'flight' ? 'fares' : 'rates'}…</p>
        </div>
      )}

      {/* empty */}
      {!loading && results && results.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No results for those dates"
            sub="Try different dates or a nearby city — availability changes by the minute."
          />
        </div>
      )}

      {/* flight results */}
      {!loading && results && results.length > 0 && type === 'flight' && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-400">
            {results.length} live fares — sorted by best value.
          </p>
          {results.map((opt) => {
            const { flags, savings, points } = sig(opt);
            return (
              <Card key={opt.id} className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 sm:w-44">
                    <AirlineBadge iata={opt.airlineIata} />
                    <span className="text-sm font-medium text-slate-800">
                      {opt.airline}
                    </span>
                  </div>

                  <div className="flex flex-1 items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-slate-900">
                        {fmtTime(opt.departAt)}
                      </div>
                      <div className="text-xs text-slate-400">{opt.originIata}</div>
                    </div>
                    <div className="flex flex-1 flex-col items-center">
                      <div className="text-xs text-slate-400">
                        {durLabel(opt.durationMins)}
                      </div>
                      <div className="my-1 flex w-full items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full border border-slate-400" />
                        <span className="h-px flex-1 bg-slate-200" />
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px]',
                            !opt.stops
                              ? 'border-brand text-brand-dark'
                              : 'border-slate-300 text-slate-400'
                          )}
                        >
                          {stopsLabel(opt.stops)}
                        </span>
                        <span className="h-px flex-1 bg-slate-200" />
                        <Plane className="h-3 w-3 rotate-90 text-slate-400" />
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-semibold text-slate-900">
                        {fmtTime(opt.arriveAt)}
                      </div>
                      <div className="text-xs text-slate-400">{opt.destIata}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 sm:w-44">
                    <div className="flex items-center gap-2">
                      {savings > 0 && (
                        <span className="text-sm text-slate-400 line-through">
                          {money(opt.marketPrice)}
                        </span>
                      )}
                      <span className="text-xl font-bold text-slate-900">
                        {money(opt.price)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="mt-1 w-full"
                      onClick={() => confirm(opt)}
                    >
                      Select
                    </Button>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <Signals flags={flags} savings={savings} points={points} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* hotel results */}
      {!loading && results && results.length > 0 && type === 'hotel' && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-slate-400">
            {results.length} live stays — sorted by best value.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((opt) => {
              const { flags, savings, points } = sig(opt);
              const perNight = Math.round(opt.price / (opt.nights || 1));
              return (
                <Card key={opt.id} pad={false} className="flex flex-col overflow-hidden">
                  <HotelImage src={opt.imageUrl} alt={opt.title} />
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Stars n={opt.star} />
                      {opt.rating != null && (
                        <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand-dark">
                          {opt.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <h3 className="line-clamp-1 font-semibold text-slate-900">
                      {opt.title}
                    </h3>
                    <p className="line-clamp-1 text-sm text-slate-400">
                      {opt.location ? `${opt.location} · ` : ''}
                      {opt.detail}
                    </p>
                    <Signals flags={flags} savings={savings} points={points} />
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <div>
                        <div className="flex items-center gap-2">
                          {savings > 0 && (
                            <span className="text-sm text-slate-400 line-through">
                              {money(opt.marketPrice)}
                            </span>
                          )}
                          <span className="text-xl font-bold text-slate-900">
                            {money(opt.price)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {money(perNight)}/night · incl. taxes
                        </p>
                      </div>
                      <Button size="sm" onClick={() => confirm(opt)}>
                        Reserve
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
