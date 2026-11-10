'use client';

/**
 * Local store of dining reservations a traveler has made, so they can review,
 * manage (via OpenTable's manage link), and cancel them. Scoped per workspace
 * (company id) and kept in localStorage — the booking itself is real (OpenTable
 * confirmation), this is the in-app record of it.
 */

export interface DiningReservation {
  id: string;
  userId: string;
  confirmation: string;
  manageUrl?: string;
  restaurantId: string;
  restaurantName: string;
  city?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  partySize: number;
  name: string;
  email?: string;
  phone?: string;
  specialRequest?: string;
  source?: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

const keyFor = (scope: string) => `hv_ent_dining_${scope || 'default'}`;

function read(scope: string): DiningReservation[] {
  try {
    const raw = localStorage.getItem(keyFor(scope));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(scope: string, list: DiningReservation[]): void {
  try {
    localStorage.setItem(keyFor(scope), JSON.stringify(list));
    window.dispatchEvent(new Event('hv-dining-change'));
  } catch {
    /* ignore */
  }
}

/** Reservations for one traveler, newest first. */
export function listReservations(scope: string, userId: string): DiningReservation[] {
  return read(scope)
    .filter((r) => r.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function saveReservation(scope: string, r: DiningReservation): void {
  const list = read(scope);
  write(scope, [r, ...list.filter((x) => x.id !== r.id)]);
}

export function setReservationStatus(
  scope: string,
  id: string,
  status: DiningReservation['status']
): void {
  write(
    scope,
    read(scope).map((r) => (r.id === id ? { ...r, status } : r))
  );
}

export function removeReservation(scope: string, id: string): void {
  write(scope, read(scope).filter((r) => r.id !== id));
}
