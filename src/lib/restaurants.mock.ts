/**
 * Server-side mock restaurant data + availability logic.
 *
 * Used by the /api/restaurants/* routes whenever OpenTable credentials are not
 * configured, so the dinner-booking and event flows are fully demoable. The
 * shapes mirror what the live OpenTable mapping returns, so swapping to the
 * real API is a route-level change only.
 */

export interface MockRestaurant {
  id: string;
  name: string;
  cuisine: string;
  genre: string; // our normalized food genre for voting
  priceBand: 1 | 2 | 3 | 4; // $ .. $$$$
  rating: number;
  city: string;
  neighborhood: string;
  image: string;
}

const IMG = (q: string) =>
  `https://images.unsplash.com/${q}?auto=format&fit=crop&w=800&q=60`;

/** A small directory keyed loosely by city; good enough for the demo. */
export const MOCK_RESTAURANTS: MockRestaurant[] = [
  { id: 'r_sushi_ko', name: 'Sushi Kō', cuisine: 'Japanese · Omakase', genre: 'Japanese', priceBand: 4, rating: 4.8, city: 'San Francisco', neighborhood: 'Hayes Valley', image: IMG('photo-1579871494447-9811cf80d66c') },
  { id: 'r_trattoria', name: 'Trattoria Rosa', cuisine: 'Italian', genre: 'Italian', priceBand: 3, rating: 4.6, city: 'San Francisco', neighborhood: 'North Beach', image: IMG('photo-1414235077428-338989a2e8c0') },
  { id: 'r_el_fuego', name: 'El Fuego', cuisine: 'Mexican', genre: 'Mexican', priceBand: 2, rating: 4.5, city: 'San Francisco', neighborhood: 'Mission', image: IMG('photo-1504674900247-0877df9cc836') },
  { id: 'r_steakhouse', name: 'The Prime Room', cuisine: 'Steakhouse', genre: 'Steakhouse', priceBand: 4, rating: 4.7, city: 'San Francisco', neighborhood: 'FiDi', image: IMG('photo-1544025162-d76694265947') },
  { id: 'r_green', name: 'Garden & Grain', cuisine: 'Vegetarian', genre: 'Vegetarian', priceBand: 2, rating: 4.4, city: 'San Francisco', neighborhood: 'SoMa', image: IMG('photo-1512621776951-a57141f2eefd') },
  { id: 'r_dragon', name: 'Golden Dragon', cuisine: 'Chinese', genre: 'Chinese', priceBand: 2, rating: 4.3, city: 'San Francisco', neighborhood: 'Chinatown', image: IMG('photo-1552566626-52f8b828add9') },
  { id: 'r_tapas', name: 'Barcelona Nights', cuisine: 'Spanish · Tapas', genre: 'Mediterranean', priceBand: 3, rating: 4.6, city: 'Austin', neighborhood: 'Downtown', image: IMG('photo-1517248135467-4c7edcad34c4') },
  { id: 'r_bbq', name: 'Smokestack BBQ', cuisine: 'Barbecue', genre: 'BBQ', priceBand: 2, rating: 4.7, city: 'Austin', neighborhood: 'East Austin', image: IMG('photo-1529193591184-b1d58069ecdd') },
  { id: 'r_curry', name: 'Saffron House', cuisine: 'Indian', genre: 'Indian', priceBand: 2, rating: 4.5, city: 'Austin', neighborhood: 'Rainey St', image: IMG('photo-1585937421612-70a008356fbe') },
  { id: 'r_bistro', name: 'Le Petit Bistro', cuisine: 'French', genre: 'French', priceBand: 3, rating: 4.6, city: 'New York', neighborhood: 'West Village', image: IMG('photo-1555396273-367ea4eb4db5') },
  { id: 'r_ramen', name: 'Ramen Yokochō', cuisine: 'Japanese · Ramen', genre: 'Japanese', priceBand: 1, rating: 4.4, city: 'New York', neighborhood: 'East Village', image: IMG('photo-1569718212165-3a8278d5f624') },
  { id: 'r_pizza', name: 'Forno Napoli', cuisine: 'Italian · Pizza', genre: 'Italian', priceBand: 2, rating: 4.5, city: 'New York', neighborhood: 'Brooklyn', image: IMG('photo-1513104890138-7c749659a591') },
];

export const GENRES = [
  'Italian',
  'Japanese',
  'Mexican',
  'Steakhouse',
  'Chinese',
  'Indian',
  'French',
  'Mediterranean',
  'BBQ',
  'Vegetarian',
] as const;

export function searchRestaurants(city?: string, genre?: string): MockRestaurant[] {
  const c = (city || '').toLowerCase();
  return MOCK_RESTAURANTS.filter((r) => {
    const cityOk = !c || r.city.toLowerCase().includes(c) || c.includes(r.city.toLowerCase());
    const genreOk = !genre || r.genre === genre;
    return cityOk && genreOk;
  });
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function toTime(mins: number): string {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
}

export interface AvailabilityResult {
  restaurantId: string;
  date: string;
  partySize: number;
  requestedTime: string;
  requestedAvailable: boolean;
  /** Bookable alternative times near the requested one (always populated). */
  slots: AvailabilitySlot[];
}

/**
 * Deterministic mock availability. The requested time may be unavailable; when
 * it is, we still return nearby bookable slots so the UI can make clear the
 * requested time isn't open and offer the closest options.
 */
export function mockAvailability(
  restaurantId: string,
  date: string,
  time: string,
  partySize: number
): AvailabilityResult {
  const base = toMinutes(time);
  const seed = hash(`${restaurantId}|${date}|${partySize}`);
  // Candidate slots every 15 min from -90 to +90 around the request.
  const offsets = [-90, -75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75, 90];
  const slots: AvailabilitySlot[] = offsets.map((off) => {
    const mins = base + off;
    // Pseudo-random but stable availability; bigger parties = fewer slots.
    const open =
      (hash(`${restaurantId}|${date}|${mins}`) % 10) >= Math.min(7, 2 + partySize);
    return { time: toTime(mins), available: open && mins >= 11 * 60 && mins <= 22 * 60 };
  });
  const requested = slots.find((s) => s.time === time);
  // Make the requested slot deterministically (un)available by its own seed.
  const requestedAvailable = Boolean(requested?.available) && seed % 3 !== 0;

  return {
    restaurantId,
    date,
    partySize,
    requestedTime: time,
    requestedAvailable,
    slots: slots.filter((s) => s.available && s.time !== time).slice(0, 8),
  };
}
