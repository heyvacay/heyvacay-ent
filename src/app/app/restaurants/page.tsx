'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  searchRestaurants,
  getAvailability,
  bookRestaurant,
  type Restaurant,
  type Availability,
  type ReservationResult,
} from '@/lib/restaurants';
import { FOOD_GENRES } from '@/lib/events';
import { Button, EmptyState, PageHeader, cn } from '@/components/app/ui';
import { todayISO } from '@/lib/format';
import { Check, Shield, MapPin } from '@/components/icons';
import { HvLoader } from '@/components/HvLoader';

export default function RestaurantsPage() {
  const { activeUser } = useStore();
  const [city, setCity] = useState('San Francisco');
  const [genre, setGenre] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('19:00');
  const [party, setParty] = useState(2);

  const [results, setResults] = useState<Restaurant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Restaurant | null>(null);

  const search = async () => {
    setLoading(true);
    try {
      setResults(await searchRestaurants(city, genre || undefined));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Dining"
        subtitle="Book restaurants for your trip — the whole reservation happens right here."
      />

      {/* search hero */}
      <div className="mb-6 rounded-3xl bg-gradient-to-br from-navy via-surface to-navy-deep p-5 ring-1 ring-white/10 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-6">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-mist/70">City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-mist/70">Cuisine</span>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-brand"
            >
              <option value="" className="text-slate-900">Any cuisine</option>
              {FOOD_GENRES.map((g) => (
                <option key={g} value={g} className="text-slate-900">{g}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-mist/70">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-mist/70">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-mist/70">Guests</span>
            <input
              type="number"
              value={party}
              onChange={(e) => setParty(Number(e.target.value) || 1)}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-brand"
            />
          </label>
        </div>
        <div className="mt-4">
          <Button onClick={search}>Find tables</Button>
        </div>
      </div>

      {loading && <HvLoader className="py-16" />}

      {!loading && results && results.length === 0 && (
        <EmptyState title="No restaurants found" sub="Try a different city or cuisine." />
      )}

      {!loading && results && results.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <div
              key={r.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-44 w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image}
                  alt={r.name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
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
                <div className="mt-auto pt-4">
                  <Button size="sm" className="w-full" onClick={() => setSelected(r)}>
                    Reserve a table
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <BookingModal
          restaurant={selected}
          date={date}
          time={time}
          party={party}
          guestName={activeUser.name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function BookingModal({
  restaurant,
  date,
  time,
  party,
  guestName,
  onClose,
}: {
  restaurant: Restaurant;
  date: string;
  time: string;
  party: number;
  guestName: string;
  onClose: () => void;
}) {
  const [avail, setAvail] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [chosenTime, setChosenTime] = useState(time);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState<ReservationResult | null>(null);

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
      const r = await bookRestaurant({
        restaurantId: restaurant.id,
        date,
        time: chosenTime,
        partySize: party,
        name: guestName,
      });
      if (r) setDone(r);
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
              <Button className="mt-4" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : loading ? (
            <HvLoader className="py-8" />
          ) : (
            <>
              {avail && !avail.requestedAvailable && (
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    <strong>{time} isn&apos;t available.</strong> Here are the closest open times —
                    pick one to book.
                  </span>
                </div>
              )}
              {avail?.requestedAvailable && (
                <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <Check className="h-4 w-4" /> {time} is available.
                </p>
              )}

              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Choose a time
              </p>
              <div className="flex flex-wrap gap-2">
                {(avail?.requestedAvailable ? [{ time, available: true }, ...(avail?.slots ?? [])] : avail?.slots ?? []).map(
                  (s) => (
                    <button
                      key={s.time}
                      onClick={() => setChosenTime(s.time)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                        chosenTime === s.time
                          ? 'border-brand bg-brand/10 text-brand-dark'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      )}
                    >
                      {s.time}
                    </button>
                  )
                )}
                {(!avail || (avail.slots.length === 0 && !avail.requestedAvailable)) && (
                  <p className="text-sm text-slate-400">No nearby times available.</p>
                )}
              </div>

              <Button className="mt-5 w-full" onClick={book} disabled={booking}>
                {booking ? 'Booking…' : `Book ${chosenTime}`}
              </Button>
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
