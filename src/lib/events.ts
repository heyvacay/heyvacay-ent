/**
 * Company travel events + group dinners (client prototype).
 *
 * An event groups teammates travelling to the same place for the same dates.
 * It carries an allow-list of hotels/flights (bookings outside it need admin
 * approval), a group chat, and an optional group-dinner flow: opt in, vote a
 * food genre, vote a restaurant, and the winner is auto-booked (via OpenTable)
 * after the host's expiration time.
 *
 * Today this lives in the browser (eventsStore); it moves to the real backend
 * with the same shapes when ent.nova is stood up.
 */

export const FOOD_GENRES = [
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

export interface EventMessage {
  id: string;
  authorId: string;
  author: string;
  text: string;
  ts: string;
  /** System messages (e.g. "dinner booked") render differently. */
  system?: boolean;
  /** Emoji → the userIds who reacted with it. */
  reactions?: Record<string, string[]>;
  /** id of the message this one replies to. */
  replyTo?: string;
}

/** The small reaction palette shown on hover in the event chat. */
export const REACTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👀'] as const;

export interface EventAttendee {
  userId: string;
  name: string;
}

export interface DinnerCandidate {
  id: string;
  name: string;
  cuisine: string;
  genre: string;
  image: string;
  rating: number;
  priceBand: number;
  neighborhood: string;
}

export interface DinnerReservation {
  confirmation: string;
  restaurantId: string;
  restaurantName: string;
  time: string;
  date: string;
  partySize: number;
}

export type DinnerPhase = 'rsvp' | 'join' | 'genre' | 'restaurant' | 'booked';

export type RsvpStatus = 'yes' | 'no' | 'maybe';

export interface Dinner {
  hostId: string;
  phase: DinnerPhase;
  date: string;
  time: string;
  /** ISO timestamp after which the host's auto-book kicks in. */
  expiresAt: string;
  attendees: EventAttendee[];
  /** Who's coming, as collected by RSVP (userId -> yes/no/maybe). */
  rsvps: Record<string, RsvpStatus>;
  genreVotes: Record<string, string>; // userId -> genre
  restaurantVotes: Record<string, string>; // userId -> restaurantId
  winningGenre?: string;
  candidates: DinnerCandidate[];
  reservation?: DinnerReservation;
  /** true once the host has broadcast the final restaurant details. */
  detailsSent?: boolean;
}

export interface TravelEvent {
  id: string;
  name: string;
  city: string;
  startDate: string;
  endDate: string;
  hostId: string;
  attendees: EventAttendee[];
  /** Allowed hotel names; empty = no restriction. */
  allowHotels: string[];
  /**
   * Smart hotel allow-list with supplier ids, so event-only booking can show
   * exactly these properties for the event dates. An admin-added hotel is
   * pre-cleared: it books without approval even if out of policy.
   */
  allowHotelList?: { hid: string; name: string }[];
  /** Allowed flight routes e.g. "SFO→AUS"; empty = no restriction. */
  allowFlights: string[];
  /** Event-city coordinates/region, used to anchor hotel search. */
  regionId?: number;
  lat?: number;
  lng?: number;
  messages: EventMessage[];
  dinner?: Dinner;
  createdAt: string;
}

export function tally(votes: Record<string, string>): { key: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const v of Object.values(votes)) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function winner(votes: Record<string, string>): string | undefined {
  return tally(votes)[0]?.key;
}

export function dinnerExpired(d: Dinner, nowISO: string): boolean {
  return nowISO >= d.expiresAt;
}

/** Seed one in-progress event so the feature is demoable immediately. */
export function seedEvents(): TravelEvent[] {
  return [
    {
      id: 'ev_austin_offsite',
      name: 'Austin Q4 Offsite',
      city: 'Austin',
      startDate: '2026-11-12',
      endDate: '2026-11-14',
      hostId: 'u_admin',
      attendees: [
        { userId: 'u_admin', name: 'You' },
      ],
      allowHotels: ['Austin Proper Hotel', 'Fairmont Austin'],
      allowFlights: ['SFO→AUS', 'JFK→AUS'],
      messages: [
        {
          id: 'm1',
          authorId: 'u_admin',
          author: 'You',
          text: 'Welcome to the Austin offsite thread! Flights + hotel are in the allow-list.',
          ts: '2026-10-25T17:00:00Z',
        },
      ],
      createdAt: '2026-10-25',
    },
  ];
}
