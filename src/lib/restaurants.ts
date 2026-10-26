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
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  name: string;
  status: string;
  source?: string;
}

export async function searchRestaurants(
  city?: string,
  genre?: string
): Promise<Restaurant[]> {
  const res = await fetch('/api/restaurants/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, genre }),
  });
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.restaurants) ? data.restaurants : [];
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
}): Promise<ReservationResult | null> {
  const res = await fetch('/api/restaurants/book', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  return res.ok ? (data as ReservationResult) : null;
}
