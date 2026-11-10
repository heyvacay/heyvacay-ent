'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Card, PageHeader, StatCard } from '@/components/app/ui';
import { Leaf, Plane, MapPin } from '@/components/icons';
import type { Booking } from '@/lib/types';

/** Rough coordinates for distance estimates (airport codes + city names). */
const COORDS: Record<string, [number, number]> = {
  sfo: [37.62, -122.38], jfk: [40.64, -73.78], nyc: [40.71, -74.0],
  lax: [33.94, -118.41], ord: [41.98, -87.9], aus: [30.2, -97.67],
  sea: [47.45, -122.31], bos: [42.37, -71.0], den: [39.86, -104.67],
  mia: [25.79, -80.29], atl: [33.64, -84.43], dfw: [32.9, -97.04],
  dca: [38.85, -77.04], lhr: [51.47, -0.45], cdg: [49.0, 2.55],
  'new york': [40.71, -74.0], 'san francisco': [37.77, -122.42],
  'los angeles': [34.05, -118.24], chicago: [41.88, -87.63],
  austin: [30.27, -97.74], seattle: [47.61, -122.33], boston: [42.36, -71.06],
  london: [51.51, -0.13], paris: [48.86, 2.35], tokyo: [35.68, 139.69],
};

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function findCoord(token: string): [number, number] | null {
  const t = token.trim().toLowerCase();
  if (COORDS[t]) return COORDS[t];
  for (const k of Object.keys(COORDS)) if (t.includes(k)) return COORDS[k];
  return null;
}

// Emission factors (kg CO2e). Economy air ≈ 0.15/km; a hotel night ≈ 30.
const AIR_KG_PER_KM = 0.15;
const HOTEL_KG_PER_NIGHT = 30;
const DEFAULT_FLIGHT_KM = 1500; // domestic average when we can't parse a route
const OFFSET_USD_PER_TONNE = 15;

function flightKm(b: Booking): number {
  // Parse "SFO → JFK" / "San Francisco to New York" from the title/detail.
  const text = `${b.title} ${b.detail}`;
  const m = text.split(/→|->|—|–| to /i);
  if (m.length >= 2) {
    const a = findCoord(m[0]);
    const z = findCoord(m[1]);
    if (a && z) return haversineKm(a, z);
  }
  const dest = b.destination ? findCoord(b.destination) : null;
  if (dest) return haversineKm([39, -98], dest); // from US centroid as a proxy
  return DEFAULT_FLIGHT_KM;
}

function nightsOf(b: Booking): number {
  const n = (Date.parse(b.endDate) - Date.parse(b.startDate)) / 86_400_000;
  return Math.max(1, Math.round(n));
}

export default function SustainabilityPage() {
  const { state, userById } = useStore();

  const data = useMemo(() => {
    const confirmed = state.bookings.filter((b) => b.status !== 'cancelled');
    let airKg = 0;
    let hotelKg = 0;
    let flights = 0;
    let nights = 0;
    const byDept: Record<string, number> = {};
    for (const b of confirmed) {
      let kg = 0;
      if (b.type === 'flight') {
        kg = flightKm(b) * AIR_KG_PER_KM;
        airKg += kg;
        flights += 1;
      } else {
        const n = nightsOf(b);
        kg = n * HOTEL_KG_PER_NIGHT;
        hotelKg += kg;
        nights += n;
      }
      const dept = b.department || userById(b.travelerId)?.department || 'Other';
      byDept[dept] = (byDept[dept] ?? 0) + kg;
    }
    const totalKg = airKg + hotelKg;
    const depts = Object.entries(byDept)
      .map(([name, kg]) => ({ name, kg }))
      .sort((a, b) => b.kg - a.kg);
    return { airKg, hotelKg, totalKg, flights, nights, depts };
  }, [state.bookings, userById]);

  const tonnes = (kg: number) => (kg / 1000).toFixed(1);
  const offsetCost = Math.round((data.totalKg / 1000) * OFFSET_USD_PER_TONNE);
  const maxDept = data.depts[0]?.kg || 1;

  return (
    <div>
      <PageHeader
        title="Sustainability"
        subtitle="Estimated travel carbon footprint across the company, with offset guidance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          accent
          label="Total footprint"
          value={`${tonnes(data.totalKg)} t`}
          sub="CO₂e, all travel"
        />
        <StatCard label="From flights" value={`${tonnes(data.airKg)} t`} sub={`${data.flights} flights`} />
        <StatCard label="From hotels" value={`${tonnes(data.hotelKg)} t`} sub={`${data.nights} room-nights`} />
        <StatCard label="Offset to net-zero" value={`$${offsetCost.toLocaleString()}`} sub={`@ $${OFFSET_USD_PER_TONNE}/tonne`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-bold text-slate-900">Where it comes from</h2>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <Plane className="h-4 w-4 text-sky-500" /> Flights
                </span>
                <span className="text-slate-500">{tonnes(data.airKg)} t</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sky-400"
                  style={{ width: `${data.totalKg ? (data.airKg / data.totalKg) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                  <MapPin className="h-4 w-4 text-emerald-500" /> Hotels
                </span>
                <span className="text-slate-500">{tonnes(data.hotelKg)} t</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${data.totalKg ? (data.hotelKg / data.totalKg) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <Leaf className="mt-0.5 h-4 w-4 shrink-0" />
            Estimates use standard factors: {AIR_KG_PER_KM} kg CO₂e per flown km (economy)
            and {HOTEL_KG_PER_NIGHT} kg per room-night. Routes are read from the trip where
            available, otherwise a {DEFAULT_FLIGHT_KM.toLocaleString()} km domestic average is used.
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold text-slate-900">By department</h2>
          {data.depts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No travel yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.depts.map((d) => (
                <div key={d.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{d.name}</span>
                    <span className="text-slate-500">{tonnes(d.kg)} t</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(d.kg / maxDept) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
