'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  searchRestaurants,
  getAvailability,
  bookRestaurant,
  cancelRestaurant,
  getRestaurantDetails,
  type Restaurant,
  type Availability,
  type ReservationResult,
  type RestaurantDetails,
} from '@/lib/restaurants';
import {
  listReservations,
  saveReservation,
  setReservationStatus,
  type DiningReservation,
} from '@/lib/diningReservations';
import { FOOD_GENRES } from '@/lib/events';
import { Button, EmptyState, Field, Input, Select, PageHeader, cn } from '@/components/app/ui';
import { CityPicker } from '@/components/app/CityPicker';
import { todayISO, shortDate } from '@/lib/format';
import { Check, Shield, MapPin, Sparkles, Calendar } from '@/components/icons';
import { HvLoader } from '@/components/HvLoader';

/** 24h "HH:mm" → a clean 12-hour label like "7:00 PM". */
function to12h(t: string): string {
  const [h, m] = (t || '').split(':').map(Number);
  if (Number.isNaN(h)) return t;
  const ap = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m || 0).padStart(2, '0')} ${ap}`;
}

/**
 * Restaurant photo with a clean branded fallback. OpenTable's directory returns
 * some venues with no (or a dead) profile photo; rather than a broken-image
 * icon we show a gradient tile with the restaurant's initial.
 */
/**
 * Honest highlight chips derived only from the real directory fields we have
 * (rating, price band, cuisine) — not fabricated editorial. Keeps the card
 * informative within what the OpenTable partner Directory API provides.
 */
function highlightsFor(r: Restaurant): string[] {
  const out: string[] = [];
  if (r.rating >= 4.7) out.push('Top rated');
  else if (r.rating >= 4.4) out.push('Well reviewed');
  if (r.priceBand >= 4) out.push('Fine dining');
  else if (r.priceBand <= 1) out.push('Budget-friendly');
  if (r.genre && r.genre !== 'Restaurant') out.push(r.genre);
  return out.slice(0, 3);
}

function RestaurantImage({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(!src);
  const letter = name.trim()[0]?.toUpperCase() || '•';
  if (failed || !src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/35 via-brand/10 to-slate-200 dark:to-slate-800">
        <span className="font-display text-5xl font-bold text-brand-dark/60">{letter}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
    />
  );
}

export default function RestaurantsPage() {
  const { activeUser, state, updateUser } = useStore();
  const scope = state.company.id;

  // Warm the OpenTable directory cache in the background so the first search is
  // fast (runs while the traveler is picking a city).
  useEffect(() => {
    fetch('/api/restaurants/warm').catch(() => {});
  }, []);

  // Traveler's reservations (local record of real OpenTable bookings).
  const [reservations, setReservations] = useState<DiningReservation[]>([]);
  const refreshReservations = () =>
    setReservations(listReservations(scope, activeUser.id));
  useEffect(() => {
    refreshReservations();
    const on = () => refreshReservations();
    window.addEventListener('hv-dining-change', on);
    return () => window.removeEventListener('hv-dining-change', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, activeUser.id]);

  const cancelReservation = async (r: DiningReservation) => {
    if (r.source === 'opentable') {
      await cancelRestaurant({ restaurantId: r.restaurantId, confirmation: r.confirmation });
    }
    setReservationStatus(scope, r.id, 'cancelled');
    refreshReservations();
  };
  const [city, setCity] = useState('');
  const [cityPicked, setCityPicked] = useState(false);
  const [genre, setGenre] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('19:00');
  const [party, setParty] = useState(2);

  const [results, setResults] = useState<Restaurant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [detailOf, setDetailOf] = useState<Restaurant | null>(null);

  // Result-side filters (work on the mock now, and on OpenTable results later).
  const [nameQuery, setNameQuery] = useState('');
  const [priceMax, setPriceMax] = useState(0); // 0 = any, else 1–4 ($–$$$$)
  const [sortBy, setSortBy] = useState<'rating' | 'price_low' | 'price_high'>('rating');

  // The field displays the full "City, Region, Country" label, but OpenTable's
  // directory is filtered by the city name only, so query by the first segment.
  const cityQuery = city.split(',')[0].trim();

  const search = async (nameArg?: string) => {
    if (cityQuery.length < 2) return;
    setLoading(true);
    try {
      setResults(await searchRestaurants(cityQuery, genre || undefined, nameArg));
    } finally {
      setLoading(false);
    }
  };

  // Once an initial search exists, typing a specific restaurant name re-queries
  // the full OpenTable directory for that city (debounced) — so the search bar
  // finds a specific place, not just filters the loaded page.
  useEffect(() => {
    if (results === null || city.trim().length < 2) return;
    const t = setTimeout(() => search(nameQuery.trim() || undefined), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameQuery]);

  const shown = (() => {
    if (!results) return [];
    const q = nameQuery.trim().toLowerCase();
    const filtered = results.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q) || (r.cuisine ?? '').toLowerCase().includes(q)) &&
        (priceMax === 0 || r.priceBand <= priceMax)
    );
    return filtered.sort((a, b) =>
      sortBy === 'rating'
        ? (b.rating ?? 0) - (a.rating ?? 0)
        : sortBy === 'price_low'
          ? a.priceBand - b.priceBand
          : b.priceBand - a.priceBand
    );
  })();

  return (
    <div>
      <PageHeader
        title="Dining"
        subtitle="Book restaurants for your trip — the whole reservation happens right here."
      />

      {/* search hero */}
      <div className="mb-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="bg-gradient-to-r from-brand/15 via-brand/5 to-transparent px-5 pt-5 sm:px-7 sm:pt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-dark">
            <Sparkles className="h-3.5 w-3.5" /> Dining
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Find a table
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Search by city and cuisine, then filter and reserve — all in one place.
          </p>
        </div>
        <div className="px-5 pb-5 pt-4 sm:px-7 sm:pb-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <Field label="City">
                <CityPicker
                  value={city}
                  selected={cityPicked}
                  placeholder="Search a city…"
                  onText={(v) => {
                    setCity(v);
                    setCityPicked(false);
                  }}
                  onPick={(p) => {
                    setCity([p.label, p.sub].filter(Boolean).join(', '));
                    setCityPicked(true);
                  }}
                />
              </Field>
            </div>
            <Field label="Cuisine">
              <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">Any cuisine</option>
                {FOOD_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Guests">
              <Input
                type="number"
                value={party}
                onChange={(e) => setParty(Number(e.target.value) || 1)}
              />
            </Field>
          </div>

          {/* quick cuisine chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['', ...FOOD_GENRES.slice(0, 6)].map((g) => (
              <button
                key={g || 'any'}
                onClick={() => setGenre(g)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition',
                  genre === g
                    ? 'bg-brand text-navy'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300'
                )}
              >
                {g || 'Any cuisine'}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <Button onClick={() => search(nameQuery.trim() || undefined)} disabled={loading || city.trim().length < 2}>
              {loading ? 'Searching…' : 'Find tables'}
            </Button>
          </div>
        </div>
      </div>

      {reservations.length > 0 && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-5">
          <h3 className="mb-3 font-display text-lg font-bold text-slate-900 dark:text-white">
            My reservations
          </h3>
          <div className="space-y-2.5">
            {reservations.map((r) => (
              <div
                key={r.id}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between',
                  r.status === 'cancelled'
                    ? 'border-slate-200 bg-slate-50 opacity-70 dark:border-white/10 dark:bg-white/5'
                    : 'border-slate-200 dark:border-white/10'
                )}
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    <span className="truncate">{r.restaurantName}</span>
                    {r.status === 'cancelled' ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Cancelled
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Confirmed
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {shortDate(r.date)} · {r.time}
                    </span>
                    <span>Party of {r.partySize}</span>
                    {r.name && <span>Under {r.name}</span>}
                    <span className="text-slate-400">Conf. {r.confirmation}</span>
                  </p>
                  {r.specialRequest && (
                    <p className="mt-1 text-xs italic text-slate-500">“{r.specialRequest}”</p>
                  )}
                </div>
                {r.status !== 'cancelled' && (
                  <div className="flex shrink-0 items-center gap-2">
                    {r.manageUrl && (
                      <a
                        href={r.manageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-brand-dark hover:underline"
                      >
                        Manage →
                      </a>
                    )}
                    <button
                      onClick={() => cancelReservation(r)}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50 dark:bg-transparent"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <HvLoader className="py-16" />}

      {!loading && results && results.length === 0 && (
        <EmptyState title="No restaurants found" sub="Try a different city or cuisine." />
      )}

      {!loading && results && results.length > 0 && (
        <>
        {/* filter / sort / search bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="relative min-w-[12rem] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Search by name or cuisine…"
              className="w-full rounded-lg border border-transparent bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-brand focus:bg-white dark:bg-white/5 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-white/10">
            {[
              { v: 0, label: 'Any $' },
              { v: 1, label: '$' },
              { v: 2, label: '$$' },
              { v: 3, label: '$$$' },
              { v: 4, label: '$$$$' },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setPriceMax(o.v)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-semibold transition',
                  priceMax === o.v ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            <option value="rating">Top rated</option>
            <option value="price_low">Price: low → high</option>
            <option value="price_high">Price: high → low</option>
          </select>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {shown.length} restaurant{shown.length === 1 ? '' : 's'}{' '}
            <span className="font-normal text-slate-400">in {city}</span>
          </h3>
        </div>
        {shown.length === 0 ? (
          <EmptyState title="No matches" sub="Loosen the filters or search a different name." />
        ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <div
              key={r.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-44 w-full overflow-hidden">
                <RestaurantImage src={r.image} name={r.name} />
                <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-xs font-bold text-slate-800 shadow-sm">
                  ★ {r.rating}
                </span>
                <span className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2 py-0.5 text-xs font-semibold text-white">
                  {'$'.repeat(r.priceBand)}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-display text-base font-bold text-slate-900">{r.name}</p>
                <p className="text-sm text-slate-500">{r.cuisine}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="h-3 w-3" /> {r.neighborhood}, {r.city}
                </p>
                {highlightsFor(r).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {highlightsFor(r).map((h) => (
                      <span
                        key={h}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex gap-2 pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDetailOf(r)}
                  >
                    Details &amp; menu
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => setSelected(r)}>
                    Reserve
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
        </>
      )}

      {detailOf && (
        <DetailsModal
          restaurant={detailOf}
          onReserve={() => {
            const r = detailOf;
            setDetailOf(null);
            setSelected(r);
          }}
          onClose={() => setDetailOf(null)}
        />
      )}

      {selected && (
        <BookingModal
          restaurant={selected}
          date={date}
          time={time}
          party={party}
          city={city}
          userId={activeUser.id}
          guestName={activeUser.name}
          guestEmail={activeUser.email}
          guestPhone={activeUser.travelProfile?.phone}
          onSaveContact={(phone) => {
            // Remember the booker's mobile the first time they enter one, so it
            // prefills next time here and anywhere else we need a contact number.
            if (phone && phone !== activeUser.travelProfile?.phone) {
              updateUser(activeUser.id, {
                travelProfile: { ...(activeUser.travelProfile ?? {}), phone },
              });
            }
          }}
          onBooked={(r) => {
            saveReservation(scope, r);
            refreshReservations();
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function money2(n?: number): string {
  if (n == null) return '';
  return `$${n.toFixed(2).replace(/\.00$/, '')}`;
}

/**
 * Rich restaurant detail — pulled live from OpenTable's Consumer/Online Booking
 * API: the rating breakdown (highlights), recent diner reviews, the full menu,
 * and bookable Experiences (shown at the bottom). Everything degrades
 * gracefully: whatever doesn't load is simply hidden.
 */
function DetailsModal({
  restaurant,
  onReserve,
  onClose,
}: {
  restaurant: Restaurant;
  onReserve: () => void;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<RestaurantDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getRestaurantDetails(restaurant.id)
      .then((d) => live && setDetails(d))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [restaurant.id]);

  const sum = details?.reviewSummary;
  const highlights: { label: string; value: string }[] = [];
  if (sum) {
    if (sum.food != null) highlights.push({ label: 'Food', value: sum.food.toFixed(1) });
    if (sum.service != null) highlights.push({ label: 'Service', value: sum.service.toFixed(1) });
    if (sum.ambience != null) highlights.push({ label: 'Ambience', value: sum.ambience.toFixed(1) });
    if (sum.value != null) highlights.push({ label: 'Value', value: sum.value.toFixed(1) });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-48 w-full overflow-hidden rounded-t-2xl">
          <RestaurantImage src={restaurant.image} name={restaurant.name} />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white hover:bg-black/80"
          >
            Close
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">{restaurant.name}</h2>
              <p className="text-sm text-slate-500">{restaurant.cuisine}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="h-3 w-3" /> {restaurant.neighborhood}, {restaurant.city}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-2xl font-bold text-slate-900">
                {sum?.overall?.toFixed(1) ?? restaurant.rating}
                <span className="text-amber-400">★</span>
              </p>
              {sum?.count != null && (
                <p className="text-xs text-slate-400">{sum.count} reviews</p>
              )}
            </div>
          </div>

          {sum?.recommendPct != null && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" /> {sum.recommendPct}% of diners recommend this restaurant
            </p>
          )}

          {highlights.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {highlights.map((h) => (
                <div key={h.label} className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                  <p className="font-display text-lg font-bold text-slate-800">{h.value}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{h.label}</p>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Loading menu, reviews &amp; experiences…
            </div>
          )}

          {/* Reviews */}
          {details && details.reviews.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 font-display text-base font-bold text-slate-900">What diners say</h3>
              <div className="space-y-3">
                {details.reviews.slice(0, 4).map((rv, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600">
                        {rv.nickname || 'Verified diner'}
                      </p>
                      {rv.rating != null && (
                        <p className="text-xs font-semibold text-amber-500">{rv.rating}★</p>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{rv.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Menu */}
          {details && details.menus.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 font-display text-base font-bold text-slate-900">Menu</h3>
              <div className="space-y-5">
                {details.menus.map((menu, mi) => (
                  <div key={mi}>
                    <p className="text-sm font-semibold text-slate-800">{menu.name}</p>
                    {menu.description && (
                      <p className="text-xs text-slate-400">{menu.description}</p>
                    )}
                    <div className="mt-2 space-y-4">
                      {menu.groups.map((g, gi) => (
                        <div key={gi}>
                          {g.name && (
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {g.name}
                            </p>
                          )}
                          <div className="space-y-1.5">
                            {g.items.map((it) => (
                              <div key={it.id} className="flex items-baseline justify-between gap-3">
                                <div>
                                  <span className="text-sm font-medium text-slate-700">{it.name}</span>
                                  {it.description && (
                                    <span className="block text-xs text-slate-400">{it.description}</span>
                                  )}
                                </div>
                                {it.price != null && (
                                  <span className="shrink-0 text-sm font-semibold text-slate-600">
                                    {money2(it.price)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Experiences — at the bottom, as requested */}
          {details && details.experiences.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-2 flex items-center gap-1.5 font-display text-base font-bold text-slate-900">
                <Sparkles className="h-4 w-4 text-brand-dark" /> Experiences
              </h3>
              <div className="space-y-2">
                {details.experiences.map((ex) => (
                  <div key={ex.id} className="rounded-xl border border-brand/30 bg-brand/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">{ex.name}</p>
                      {ex.price != null && (
                        <p className="shrink-0 text-sm font-semibold text-brand-dark">
                          {money2(ex.price)}
                        </p>
                      )}
                    </div>
                    {ex.description && (
                      <p className="mt-0.5 text-xs text-slate-500">{ex.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onReserve}>Reserve a table</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingModal({
  restaurant,
  date,
  time,
  party,
  city,
  userId,
  guestName,
  guestEmail,
  guestPhone,
  onSaveContact,
  onBooked,
  onClose,
}: {
  restaurant: Restaurant;
  date: string;
  time: string;
  party: number;
  city: string;
  userId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  onSaveContact?: (phone: string) => void;
  onBooked: (r: DiningReservation) => void;
  onClose: () => void;
}) {
  const [avail, setAvail] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [chosenTime, setChosenTime] = useState(time);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState<ReservationResult | null>(null);
  const [email, setEmail] = useState(guestEmail ?? '');
  const [phone, setPhone] = useState(guestPhone ?? '');
  const [resName, setResName] = useState(guestName);
  const [special, setSpecial] = useState('');
  const contactOk =
    resName.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(email) &&
    phone.replace(/\D/g, '').length >= 10;

  // Load availability on open.
  useEffect(() => {
    let live = true;
    getAvailability({ restaurantId: restaurant.id, date, time, partySize: party })
      .then((a) => {
        if (!live) return;
        setAvail(a);
        if (a && !a.requestedAvailable && a.slots[0]) setChosenTime(a.slots[0].time);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [restaurant.id, date, time, party]);

  const book = async () => {
    setBooking(true);
    try {
      const finalName = resName.trim() || guestName;
      const specialReq = special.trim() || undefined;
      const r = await bookRestaurant({
        restaurantId: restaurant.id,
        date,
        time: chosenTime,
        partySize: party,
        name: finalName,
        email: email.trim(),
        phone: phone.trim(),
        specialRequest: specialReq,
      });
      if (r) {
        setDone(r);
        onSaveContact?.(phone.trim());
        onBooked({
          id: `dr_${Math.random().toString(36).slice(2, 10)}`,
          userId,
          confirmation: r.confirmation,
          manageUrl: r.manageUrl,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          city,
          date,
          time: chosenTime,
          partySize: party,
          name: finalName,
          email: email.trim(),
          phone: phone.trim(),
          specialRequest: specialReq,
          source: r.source,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      setBooking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">{restaurant.name}</h2>
            <p className="text-xs text-slate-400">
              {date} · party of {party}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>

        <div className="px-5 py-4">
          {done ? (
            <div className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="h-6 w-6" />
              </span>
              <p className="mt-3 font-display text-lg font-bold text-slate-900">Table booked</p>
              <p className="mt-1 text-sm text-slate-500">
                {restaurant.name} · {date} at {done.time} · party of {party}
              </p>
              <p className="mt-1 text-xs text-slate-400">Confirmation {done.confirmation}</p>
              {done.depositRequired && (
                <p className="mx-auto mt-2 max-w-xs rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                  This venue required a card on file / deposit to hold the table.
                  OpenTable manages the hold — review the cancellation policy on your
                  reservation to avoid a charge.
                </p>
              )}
              {done.source === 'opentable' ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                  <Check className="h-3 w-3" /> Confirmed on OpenTable
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-amber-600">
                  Held locally — not confirmed with the restaurant (OpenTable didn&apos;t accept it).
                </p>
              )}
              {done.manageUrl && (
                <a
                  href={done.manageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-xs font-semibold text-brand-dark hover:underline"
                >
                  Manage reservation →
                </a>
              )}
              <Button className="mt-4" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : loading ? (
            <HvLoader className="py-8" />
          ) : (
            <>
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                <span>
                  <strong>HeyVacay is an OpenTable Premier Booking Partner.</strong> We&apos;ll make
                  sure the restaurant takes great care of you — book with confidence.
                </span>
              </div>
              {(() => {
                const times = avail?.requestedAvailable
                  ? [{ time, available: true }, ...(avail?.slots ?? [])]
                  : avail?.slots ?? [];
                const none = !avail || (avail.slots.length === 0 && !avail.requestedAvailable);
                return (
                  <>
                    {avail?.requestedAvailable ? (
                      <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                        <Check className="h-4 w-4" /> {to12h(time)} is available
                      </p>
                    ) : !none ? (
                      <p className="mb-3 text-sm text-slate-500">
                        <span className="font-semibold text-slate-700">{to12h(time)}</span> is booked — here are the
                        closest open tables.
                      </p>
                    ) : null}

                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {avail?.requestedAvailable ? 'Pick a time' : 'Nearest available'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {shortDate(date)} · {party} {party === 1 ? 'guest' : 'guests'}
                      </p>
                    </div>
                    {none ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                        No tables near {to12h(time)}. Try another time or date.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {times.map((s) => {
                          const isReq = s.time === time;
                          const isSel = chosenTime === s.time;
                          return (
                            <button
                              key={s.time}
                              onClick={() => setChosenTime(s.time)}
                              className={cn(
                                'relative rounded-xl border px-2 py-2.5 text-sm font-semibold transition',
                                isSel
                                  ? 'border-brand bg-brand text-navy shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-brand/50 hover:bg-brand/5 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                              )}
                            >
                              {to12h(s.time)}
                              {isReq && !isSel && (
                                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                                  yours
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="mt-4 space-y-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Name on the reservation
                  </label>
                  <Input
                    value={resName}
                    onChange={(e) => setResName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Mobile</label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(512) 555-0142"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Special request <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={special}
                    onChange={(e) => setSpecial(e.target.value)}
                    rows={2}
                    placeholder="Dietary needs, occasion, seating preference…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                The restaurant uses your email &amp; mobile to confirm the table.
              </p>

              <Button
                className="mt-4 w-full"
                onClick={book}
                disabled={booking || !chosenTime || !contactOk}
              >
                {booking ? 'Booking…' : `Book ${chosenTime}`}
              </Button>
              {!contactOk && (
                <p className="mt-1 text-center text-[11px] text-slate-400">
                  Add a valid email and mobile to confirm the reservation.
                </p>
              )}
              {avail?.source && avail.source.includes('mock') && (
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  Demo availability · live OpenTable data when keys are set.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
