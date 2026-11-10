'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Card, PageHeader, StatCard, Badge } from '@/components/app/ui';
import { dateRange } from '@/lib/format';
import { MapPin, Plane } from '@/components/icons';
import type { Booking } from '@/lib/types';

/**
 * A small lat/lng lookup for common destinations, keyed by lowercase name or
 * IATA code. Enough to place most trips on the schematic map; anything we don't
 * recognize still shows in the traveler list below.
 */
const PLACES: Record<string, { lat: number; lng: number; label: string }> = {
  'new york': { lat: 40.71, lng: -74.0, label: 'New York' },
  nyc: { lat: 40.71, lng: -74.0, label: 'New York' },
  jfk: { lat: 40.71, lng: -74.0, label: 'New York' },
  'san francisco': { lat: 37.77, lng: -122.42, label: 'San Francisco' },
  sfo: { lat: 37.77, lng: -122.42, label: 'San Francisco' },
  'los angeles': { lat: 34.05, lng: -118.24, label: 'Los Angeles' },
  lax: { lat: 34.05, lng: -118.24, label: 'Los Angeles' },
  chicago: { lat: 41.88, lng: -87.63, label: 'Chicago' },
  ord: { lat: 41.88, lng: -87.63, label: 'Chicago' },
  austin: { lat: 30.27, lng: -97.74, label: 'Austin' },
  aus: { lat: 30.27, lng: -97.74, label: 'Austin' },
  seattle: { lat: 47.61, lng: -122.33, label: 'Seattle' },
  sea: { lat: 47.61, lng: -122.33, label: 'Seattle' },
  boston: { lat: 42.36, lng: -71.06, label: 'Boston' },
  bos: { lat: 42.36, lng: -71.06, label: 'Boston' },
  denver: { lat: 39.74, lng: -104.99, label: 'Denver' },
  den: { lat: 39.74, lng: -104.99, label: 'Denver' },
  miami: { lat: 25.76, lng: -80.19, label: 'Miami' },
  mia: { lat: 25.76, lng: -80.19, label: 'Miami' },
  atlanta: { lat: 33.75, lng: -84.39, label: 'Atlanta' },
  atl: { lat: 33.75, lng: -84.39, label: 'Atlanta' },
  dallas: { lat: 32.78, lng: -96.8, label: 'Dallas' },
  dfw: { lat: 32.78, lng: -96.8, label: 'Dallas' },
  'washington': { lat: 38.91, lng: -77.04, label: 'Washington, DC' },
  dca: { lat: 38.91, lng: -77.04, label: 'Washington, DC' },
  london: { lat: 51.51, lng: -0.13, label: 'London' },
  lhr: { lat: 51.51, lng: -0.13, label: 'London' },
  paris: { lat: 48.86, lng: 2.35, label: 'Paris' },
  cdg: { lat: 48.86, lng: 2.35, label: 'Paris' },
  berlin: { lat: 52.52, lng: 13.4, label: 'Berlin' },
  amsterdam: { lat: 52.37, lng: 4.9, label: 'Amsterdam' },
  tokyo: { lat: 35.68, lng: 139.69, label: 'Tokyo' },
  singapore: { lat: 1.35, lng: 103.82, label: 'Singapore' },
  sydney: { lat: -33.87, lng: 151.21, label: 'Sydney' },
  toronto: { lat: 43.65, lng: -79.38, label: 'Toronto' },
  'mexico city': { lat: 19.43, lng: -99.13, label: 'Mexico City' },
  dubai: { lat: 25.2, lng: 55.27, label: 'Dubai' },
};

function lookupPlace(dest?: string, title?: string) {
  const hay = `${dest ?? ''} ${title ?? ''}`.toLowerCase();
  // Prefer a longer key match (e.g. "new york" before "york").
  const keys = Object.keys(PLACES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (hay.includes(k)) return PLACES[k];
  }
  return null;
}

// Equirectangular projection into a 0..100 viewBox space.
const projX = (lng: number) => ((lng + 180) / 360) * 100;
const projY = (lat: number) => ((90 - lat) / 180) * 100;

export default function TravelerMapPage() {
  const { state, userById } = useStore();
  const today = new Date().toISOString().slice(0, 10);

  const { active, upcoming } = useMemo(() => {
    const confirmed = state.bookings.filter((b) => b.status === 'confirmed');
    const act = confirmed.filter((b) => b.startDate <= today && b.endDate >= today);
    const up = confirmed
      .filter((b) => b.startDate > today)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
      .slice(0, 12);
    return { active: act, upcoming: up };
  }, [state.bookings, today]);

  // Group active trips by place for the pins.
  const pins = useMemo(() => {
    const byPlace = new Map<
      string,
      { lat: number; lng: number; label: string; trips: Booking[] }
    >();
    for (const b of active) {
      const p = lookupPlace(b.destination, b.title);
      if (!p) continue;
      const key = p.label;
      const entry = byPlace.get(key) ?? { ...p, trips: [] };
      entry.trips.push(b);
      byPlace.set(key, entry);
    }
    return [...byPlace.values()];
  }, [active]);

  const travelerName = (b: Booking) => b.guestName || userById(b.travelerId)?.name || 'Traveler';
  const placed = new Set(pins.flatMap((p) => p.trips.map((t) => t.id)));
  const unplaced = active.filter((b) => !placed.has(b.id));

  return (
    <div>
      <PageHeader
        title="Live traveler map"
        subtitle="Where your people are right now, and who's heading out next."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Travelers out now" value={active.length} sub={active.length ? 'On the road today' : 'Everyone home'} />
        <StatCard label="Cities" value={pins.length + (unplaced.length ? 1 : 0)} sub="Active destinations" />
        <StatCard label="Departing soon" value={upcoming.length} sub="Next trips upcoming" />
      </div>

      <Card className="mt-6 overflow-hidden" pad={false}>
        <div className="relative aspect-[2/1] w-full bg-slate-900">
          {/* schematic world backdrop: a dotted grid */}
          <svg viewBox="0 0 100 50" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <defs>
              <pattern id="dots" width="2.5" height="2.5" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.28" fill="rgba(148,163,184,0.35)" />
              </pattern>
            </defs>
            <rect width="100" height="50" fill="url(#dots)" />
          </svg>
          {/* pins */}
          {pins.map((p) => {
            const x = projX(p.lng);
            const y = projY(p.lat) / 2; // viewBox height is 50 → scale lat into it
            return (
              <div
                key={p.label}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <span className="relative flex h-3.5 w-3.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" />
                  <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand ring-2 ring-white/70 text-[8px] font-bold text-navy-deep">
                    {p.trips.length}
                  </span>
                </span>
                <div className="pointer-events-none absolute left-1/2 top-4 z-10 hidden w-44 -translate-x-1/2 rounded-lg bg-white p-2 text-left text-xs shadow-lg group-hover:block">
                  <p className="font-semibold text-slate-800">{p.label}</p>
                  {p.trips.slice(0, 4).map((t) => (
                    <p key={t.id} className="text-slate-500">
                      {travelerName(t)} · {dateRange(t.startDate, t.endDate)}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
          {active.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
              No one is traveling today.
            </div>
          )}
        </div>
      </Card>

      {/* Active travelers list */}
      {active.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-display text-lg font-bold text-slate-900">On the road now</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {active.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    {b.type === 'flight' ? <Plane className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{travelerName(b)}</p>
                    <p className="text-xs text-slate-400">{b.destination || b.title}</p>
                  </div>
                </div>
                <span className="whitespace-nowrap text-xs text-slate-500">{dateRange(b.startDate, b.endDate)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upcoming departures */}
      {upcoming.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-display text-lg font-bold text-slate-900">Departing soon</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    {b.type === 'flight' ? <Plane className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{travelerName(b)}</p>
                    <p className="text-xs text-slate-400">{b.destination || b.title}</p>
                  </div>
                </div>
                <Badge color="slate">{dateRange(b.startDate, b.endDate)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
