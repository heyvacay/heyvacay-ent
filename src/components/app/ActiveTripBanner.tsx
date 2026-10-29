'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import type { Booking } from '@/lib/types';
import { parseLocal } from '@/lib/format';
import { Plane, MapPin, Receipt, Sparkles } from '@/components/icons';

interface Weather {
  tempF: number;
  label: string;
  emoji: string;
}

function greetingWord(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function hashNum(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Context-aware greeting for a traveler who is on, or about to start, a trip.
 * Renders nothing when there's no active/imminent trip. Weather comes from the
 * /api/weather proxy (OpenWeather when keyed, mock otherwise); flight status is
 * a stable mock until a live flight-status feed is wired.
 */
export function ActiveTripBanner() {
  const { activeUser, state } = useStore();
  const [weather, setWeather] = useState<Weather | null>(null);

  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);

  const trip = useMemo<Booking | null>(() => {
    const mine = state.bookings.filter(
      (b) => b.travelerId === activeUser.id && b.status === 'confirmed'
    );
    // A flight today takes priority, then a hotel covering today, then the
    // soonest upcoming trip within 2 days.
    const flightToday = mine.find((b) => b.type === 'flight' && b.startDate === todayStr);
    if (flightToday) return flightToday;
    const hotelNow = mine.find(
      (b) => b.type === 'hotel' && b.startDate <= todayStr && b.endDate >= todayStr
    );
    if (hotelNow) return hotelNow;
    const soon = mine
      .filter((b) => b.startDate > todayStr)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
    if (soon) {
      const days = Math.round(
        (new Date(soon.startDate).getTime() - now) / 86400000
      );
      return days <= 2 ? soon : null;
    }
    return null;
  }, [state.bookings, activeUser.id, todayStr, now]);

  const destination = trip?.destination || trip?.title || '';

  useEffect(() => {
    if (!destination) {
      setWeather(null);
      return;
    }
    let live = true;
    fetch('/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: destination }),
    })
      .then((r) => r.json())
      .then((w) => live && w?.tempF != null && setWeather(w))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [destination]);

  if (!trip) return null;

  const first = activeUser.name.split(' ')[0];
  const destCity = cityOf(destination);
  const weatherStr = weather ? `${weather.tempF}°F, ${weather.label.toLowerCase()} ${weather.emoji}` : '';
  const longDate = (iso: string) =>
    parseLocal(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  let headline = '';
  let sub = '';

  if (trip.type === 'flight') {
    const depart = trip.departAt ? new Date(trip.departAt).getTime() : null;
    const arrive = trip.arriveAt ? new Date(trip.arriveAt).getTime() : null;
    const hoursToDepart = depart ? (depart - now) / 3600000 : null;
    const airlineSite = trip.airline ? `${trip.airline}'s website` : "your airline's website";

    // Stable mock flight status.
    const statusSeed = hashNum(trip.id + todayStr) % 10;
    const status = statusSeed === 9 ? 'cancelled' : statusSeed >= 7 ? 'delayed' : 'ontime';

    if (arrive && now >= arrive && now <= arrive + 3600_000) {
      headline = `Welcome to ${destCity}! ✈️`;
      sub = weatherStr ? `It's currently ${weatherStr}. Enjoy your time here!` : 'Enjoy your time here!';
    } else if (hoursToDepart != null && hoursToDepart <= 4 && hoursToDepart > -2) {
      headline = `Good ${greetingWord()}, ${first}!`;
      if (status === 'ontime')
        sub = `Your flight is on time and expected to depart at ${fmtTime(trip.departAt)}. Safe travels!`;
      else if (status === 'delayed')
        sub = `Your flight is delayed — new departure time ${fmtTime(trip.departAt)}. We apologize for the inconvenience.`;
      else
        sub = `Your flight is cancelled. We apologize — please work with the airline at the airport to rebook, and contact us if you have any issues.`;
    } else if (hoursToDepart != null && hoursToDepart <= 24 && hoursToDepart > 4) {
      headline = `Good ${greetingWord()}, ${first}, your trip is almost here!`;
      sub = `It's time to check in! Visit ${airlineSite} to check in for your flight to ${destCity}.`;
    } else {
      headline = `Hi ${first}! Get ready for your flight to ${destCity}. ✈️`;
      sub = trip.departAt ? `Departing ${fmtTime(trip.departAt)}.` : `Departing ${longDate(trip.startDate)}.`;
    }
  } else {
    // Hotel / in-destination.
    const daysLeft = Math.max(
      0,
      Math.round((parseLocal(trip.endDate).getTime() - now) / 86400000)
    );
    if (trip.startDate === todayStr) {
      headline = `Welcome to ${destCity}!`;
      sub = weatherStr
        ? `It's currently ${weatherStr}. ${trip.title} has your room ready and is excited to welcome you!`
        : `${trip.title} has your room ready and is excited to welcome you!`;
    } else if (trip.startDate > todayStr) {
      headline = `Hi ${first}! Get ready for your trip to ${destCity}.`;
      sub = `Starting ${longDate(trip.startDate)}.`;
    } else {
      headline = `Hi ${first}!`;
      sub = `It's currently ${weatherStr || 'a great day'} in ${destCity} and you have ${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trip.`;
    }
  }

  // On-trip = the stay/flight covers today. In that window we surface the
  // "what you need right now" actions: log an expense, scan a receipt, manage.
  const onTrip =
    (trip.type === 'hotel' && trip.startDate <= todayStr && trip.endDate >= todayStr) ||
    (trip.type === 'flight' && trip.startDate === todayStr);

  return (
    <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-navy-deep to-navy p-5 text-white sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
            {trip.type === 'flight' ? <Plane className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold leading-tight">{headline}</h2>
            <p className="mt-1 text-sm text-slate-300">{sub}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {onTrip && (
            <>
              <Link
                href={`/app/expenses?scan=1&trip=${trip.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-navy-deep hover:brightness-95"
              >
                <Sparkles className="h-4 w-4" /> Scan receipt
              </Link>
              <Link
                href={`/app/expenses?new=1&trip=${trip.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/25"
              >
                <Receipt className="h-4 w-4" /> Add expense
              </Link>
            </>
          )}
          <Link
            href="/app/trips"
            className="inline-flex items-center rounded-lg bg-white/15 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/25"
          >
            {onTrip ? 'Manage trip' : 'View trip'}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** City portion of a location string ("San Francisco, USA" -> "San Francisco"). */
function cityOf(s: string): string {
  return s.split(',')[0].trim() || s;
}
