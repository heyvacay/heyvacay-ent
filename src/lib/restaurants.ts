'use client';

/** Client calls to the restaurant proxy routes (OpenTable, mock fallback). */

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  genre: string;
  priceBand: number;
  rating: number;
  city: string;
  neighborhood: string;
  image: string;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
}

export interface Availability {
  restaurantId: string;
  date: string;
  partySize: number;
  requestedTime: string;
  requestedAvailable: boolean;
  slots: AvailabilitySlot[];
  source?: string;
}

export interface ReservationResult {
  confirmation: string;
  manageUrl?: string;
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  name: string;
  status: string;
  /** The venue required a card hold / deposit to hold the table. */
  depositRequired?: boolean;
  source?: string;
}

export async function searchRestaurants(
  city?: string,
  genre?: string,
  name?: string
): Promise<Restaurant[]> {
  const res = await fetch('/api/restaurants/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, genre, name }),
  });
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.restaurants) ? data.restaurants : [];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
}
export interface MenuGroup {
  name: string;
  items: MenuItem[];
}
export interface RestaurantMenu {
  name: string;
  description?: string;
  groups: MenuGroup[];
}
export interface RestaurantExperience {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  bookable?: boolean;
}
export interface RestaurantReview {
  nickname?: string;
  rating?: number;
  text?: string;
  dinedAt?: string;
  recommended?: boolean;
}
export interface ReviewSummary {
  overall?: number;
  count?: number;
  food?: number;
  service?: number;
  ambience?: number;
  value?: number;
  recommendPct?: number;
}
export interface RestaurantDetails {
  rid: string;
  live: boolean;
  menus: RestaurantMenu[];
  experiences: RestaurantExperience[];
  reviews: RestaurantReview[];
  reviewSummary: ReviewSummary | null;
}

/** Rich detail (menus, experiences, reviews, rating summary) for one venue. */
export async function getRestaurantDetails(rid: string): Promise<RestaurantDetails | null> {
  try {
    const res = await fetch(`/api/restaurants/${encodeURIComponent(rid)}/details`);
    const data = await res.json().catch(() => null);
    return res.ok ? (data as RestaurantDetails) : null;
  } catch {
    return null;
  }
}

export async function getAvailability(args: {
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
}): Promise<Availability | null> {
  const res = await fetch('/api/restaurants/availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  return res.ok ? (data as Availability) : null;
}

export async function bookRestaurant(args: {
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  name: string;
  email?: string;
  phone?: string;
  specialRequest?: string;
}): Promise<ReservationResult | null> {
  const res = await fetch('/api/restaurants/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  return res.ok ? (data as ReservationResult) : null;
}

export async function cancelRestaurant(args: {
  restaurantId: string;
  confirmation: string;
}): Promise<{ cancelled: boolean }> {
  try {
    const res = await fetch('/api/restaurants/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await res.json().catch(() => null);
    return { cancelled: Boolean(data?.cancelled) };
  } catch {
    return { cancelled: false };
  }
}
