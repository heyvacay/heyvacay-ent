'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { cancelRestaurant, type Restaurant } from '@/lib/restaurants';
import {
  listReservations,
  setReservationStatus,
  type DiningReservation,
} from '@/lib/diningReservations';
import { FOOD_GENRES } from '@/lib/events';
import { Button, Field, Input, Select, PageHeader, cn } from '@/components/app/ui';
import { DiningSearchBox } from '@/components/app/DiningSearchBox';
import { todayISO, shortDate } from '@/lib/format';
import { Sparkles, Calendar } from '@/components/icons';

/**
 * Dining landing — one smart search box (city → restaurant), plus the traveler's
 * reservations. Running a search navigates to the dedicated results page so the
 * grid + filters get the whole screen and this page stays clean.
 */
export default function RestaurantsPage() {
  const { activeUser, state } = useStore();
  const router = useRouter();
  const scope = state.company.id;

  // Warm the OpenTable directory cache so the first search is fast.
  useEffect(() => {
    fetch('/api/restaurants/warm').catch(() => {});
  }, []);

  const [reservations, setReservations] = useState<DiningReservation[]>([]);
  const refreshReservations = () => setReservations(listReservations(scope, activeUser.id));
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
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [genre, setGenre] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('19:00');
  const [party, setParty] = useState(2);

  const buildUrl = (extra?: Record<string, string>) => {
    const p = new URLSearchParams({
      city,
      date,
      time,
      party: String(party),
    });
    if (lat != null) p.set('lat', String(lat));
    if (lng != null) p.set('lng', String(lng));
    if (genre) p.set('genre', genre);
    for (const [k, v] of Object.entries(extra || {})) p.set(k, v);
    return `/app/restaurants/results?${p.toString()}`;
  };

  const goSearch = () => {
    if (city.trim().length < 2) return;
    router.push(buildUrl());
  };
  const goRestaurant = (r: Restaurant) => router.push(buildUrl({ name: r.name, rid: r.id }));

  return (
    <div>
      <PageHeader
        title="Dining"
        subtitle="Book restaurants for your trip — in and around the city, all in one place."
      />

      <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="bg-gradient-to-r from-brand/15 via-brand/5 to-transparent px-5 pt-5 sm:px-7 sm:pt-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-dark">
            <Sparkles className="h-3.5 w-3.5" /> Dining
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Find a table
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Search a city, then a specific restaurant — we&apos;ll show tables in and near it.
          </p>
        </div>
        <div className="px-5 pb-5 pt-4 sm:px-7 sm:pb-6">
          <div className="grid gap-3 lg:grid-cols-6">
            <div className="lg:col-span-3">
              <Field label="Where & what">
                <DiningSearchBox
                  city={city}
                  lat={lat}
                  lng={lng}
                  genre={genre}
                  onCity={(label, la, ln) => {
                    setCity(label);
                    setLat(la);
                    setLng(ln);
                  }}
                  onClearCity={() => {
                    setCity('');
                    setLat(undefined);
                    setLng(undefined);
                  }}
                  onSearchAll={goSearch}
                  onPickRestaurant={goRestaurant}
                />
              </Field>
            </div>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Guests">
              <Input type="number" value={party} onChange={(e) => setParty(Number(e.target.value) || 1)} />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Cuisine (optional)">
              <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">Any cuisine</option>
                {FOOD_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Button className="sm:mb-0.5" onClick={goSearch} disabled={city.trim().length < 2}>
              Find tables
            </Button>
          </div>
        </div>
      </div>

      {reservations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-5">
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
    </div>
  );
}
