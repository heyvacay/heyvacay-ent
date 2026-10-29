/**
 * Whether a traveler needs a hotel for an event, with a robust fallback.
 *
 * Prefer coordinates (home >50mi from the event = needs a hotel). When coords
 * are missing (older events, or a city picked without geo), fall back to
 * comparing the home city to the event city by name so "home = event city"
 * correctly reads as local — no hotel, and no misleading "no home city set".
 */
import { milesBetween } from './format';

export interface HotelNeed {
  needs: boolean;
  /** Distance in miles when it could be computed from coordinates. */
  dist: number | null;
  reason: 'no-home' | 'same-city' | 'far' | 'near' | 'unknown';
}

const normCity = (s?: string): string =>
  (s ?? '')
    .toLowerCase()
    .split(',')[0]
    .replace(/[^a-z\s]/g, '')
    .trim();

export function hotelNeed(opts: {
  homeCity?: string;
  homeLat?: number | null;
  homeLng?: number | null;
  eventCity?: string;
  eventLat?: number | null;
  eventLng?: number | null;
}): HotelNeed {
  const { homeCity, homeLat, homeLng, eventCity, eventLat, eventLng } = opts;

  // No home city on file at all — we genuinely don't know.
  if (!homeCity || !homeCity.trim()) return { needs: true, dist: null, reason: 'no-home' };

  // Best signal: real distance.
  if (homeLat != null && homeLng != null && eventLat != null && eventLng != null) {
    const dist = milesBetween(homeLat, homeLng, eventLat, eventLng);
    return { needs: dist > 50, dist, reason: dist > 50 ? 'far' : 'near' };
  }

  // Fallback: same city name = local.
  const home = normCity(homeCity);
  const ev = normCity(eventCity);
  if (home && ev && (home === ev || home.includes(ev) || ev.includes(home))) {
    return { needs: false, dist: null, reason: 'same-city' };
  }

  // Different city and no coordinates — assume a hotel may be needed, but we
  // know the home city, so this is not a "no home city set" case.
  return { needs: true, dist: null, reason: 'unknown' };
}
