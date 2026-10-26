'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  seedEvents,
  type DinnerCandidate,
  type DinnerReservation,
  type EventAttendee,
  type TravelEvent,
} from './events';
import { uid } from './format';

const KEY = 'hv_events_v1';

interface EventsApi {
  events: TravelEvent[];
  eventById: (id: string) => TravelEvent | undefined;
  createEvent: (data: {
    name: string;
    city: string;
    startDate: string;
    endDate: string;
    hostId: string;
    hostName: string;
    allowHotels: string[];
    allowFlights: string[];
    attendees: EventAttendee[];
  }) => TravelEvent;
  addMessage: (eventId: string, authorId: string, author: string, text: string) => void;
  joinEvent: (eventId: string, userId: string, name: string) => void;

  startDinner: (eventId: string, hostId: string, date: string, time: string, expiresAt: string) => void;
  joinDinner: (eventId: string, userId: string, name: string) => void;
  advanceToGenre: (eventId: string) => void;
  voteGenre: (eventId: string, userId: string, genre: string) => void;
  setCandidates: (eventId: string, winningGenre: string, candidates: DinnerCandidate[]) => void;
  voteRestaurant: (eventId: string, userId: string, restaurantId: string) => void;
  setReservation: (eventId: string, reservation: DinnerReservation, author: string) => void;

  reset: () => void;
}

const Ctx = createContext<EventsApi | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<TravelEvent[]>(seedEvents());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setEvents(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(events));
    } catch {
      /* ignore */
    }
  }, [events, hydrated]);

  const eventById = useCallback((id: string) => events.find((e) => e.id === id), [events]);

  const patch = useCallback(
    (id: string, fn: (e: TravelEvent) => TravelEvent) =>
      setEvents((es) => es.map((e) => (e.id === id ? fn(e) : e))),
    []
  );

  const msg = (authorId: string, author: string, text: string, system = false) => ({
    id: uid('m'),
    authorId,
    author,
    text,
    ts: new Date().toISOString(),
    system,
  });

  const createEvent: EventsApi['createEvent'] = useCallback((data) => {
    const ev: TravelEvent = {
      id: uid('ev'),
      name: data.name,
      city: data.city,
      startDate: data.startDate,
      endDate: data.endDate,
      hostId: data.hostId,
      attendees:
        data.attendees.length > 0
          ? data.attendees
          : [{ userId: data.hostId, name: data.hostName }],
      allowHotels: data.allowHotels,
      allowFlights: data.allowFlights,
      messages: [msg(data.hostId, data.hostName, `Created the "${data.name}" event thread.`, true)],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setEvents((es) => [ev, ...es]);
    return ev;
  }, []);

  const addMessage: EventsApi['addMessage'] = useCallback(
    (eventId, authorId, author, text) =>
      patch(eventId, (e) => ({ ...e, messages: [...e.messages, msg(authorId, author, text)] })),
    [patch]
  );

  const joinEvent: EventsApi['joinEvent'] = useCallback(
    (eventId, userId, name) =>
      patch(eventId, (e) =>
        e.attendees.some((a) => a.userId === userId)
          ? e
          : {
              ...e,
              attendees: [...e.attendees, { userId, name }],
              messages: [...e.messages, msg(userId, name, `${name} joined the event.`, true)],
            }
      ),
    [patch]
  );

  const startDinner: EventsApi['startDinner'] = useCallback(
    (eventId, hostId, date, time, expiresAt) =>
      patch(eventId, (e) => {
        const host = e.attendees.find((a) => a.userId === hostId);
        return {
          ...e,
          dinner: {
            hostId,
            phase: 'join',
            date,
            time,
            expiresAt,
            attendees: host ? [host] : [],
            genreVotes: {},
            restaurantVotes: {},
            candidates: [],
          },
          messages: [
            ...e.messages,
            msg(hostId, host?.name ?? 'Host', `started planning a group dinner for ${date} at ${time}. Who's in?`, true),
          ],
        };
      }),
    [patch]
  );

  const joinDinner: EventsApi['joinDinner'] = useCallback(
    (eventId, userId, name) =>
      patch(eventId, (e) =>
        !e.dinner || e.dinner.attendees.some((a) => a.userId === userId)
          ? e
          : { ...e, dinner: { ...e.dinner, attendees: [...e.dinner.attendees, { userId, name }] } }
      ),
    [patch]
  );

  const advanceToGenre: EventsApi['advanceToGenre'] = useCallback(
    (eventId) =>
      patch(eventId, (e) => (e.dinner ? { ...e, dinner: { ...e.dinner, phase: 'genre' } } : e)),
    [patch]
  );

  const voteGenre: EventsApi['voteGenre'] = useCallback(
    (eventId, userId, genre) =>
      patch(eventId, (e) =>
        e.dinner
          ? { ...e, dinner: { ...e.dinner, genreVotes: { ...e.dinner.genreVotes, [userId]: genre } } }
          : e
      ),
    [patch]
  );

  const setCandidates: EventsApi['setCandidates'] = useCallback(
    (eventId, winningGenre, candidates) =>
      patch(eventId, (e) =>
        e.dinner
          ? { ...e, dinner: { ...e.dinner, phase: 'restaurant', winningGenre, candidates } }
          : e
      ),
    [patch]
  );

  const voteRestaurant: EventsApi['voteRestaurant'] = useCallback(
    (eventId, userId, restaurantId) =>
      patch(eventId, (e) =>
        e.dinner
          ? {
              ...e,
              dinner: {
                ...e.dinner,
                restaurantVotes: { ...e.dinner.restaurantVotes, [userId]: restaurantId },
              },
            }
          : e
      ),
    [patch]
  );

  const setReservation: EventsApi['setReservation'] = useCallback(
    (eventId, reservation, author) =>
      patch(eventId, (e) =>
        e.dinner
          ? {
              ...e,
              dinner: { ...e.dinner, phase: 'booked', reservation },
              messages: [
                ...e.messages,
                msg(
                  'system',
                  author,
                  `🍽️ Group dinner booked — ${reservation.restaurantName} on ${reservation.date} at ${reservation.time} for ${reservation.partySize}. Confirmation ${reservation.confirmation}.`,
                  true
                ),
              ],
            }
          : e
      ),
    [patch]
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setEvents(seedEvents());
  }, []);

  return (
    <Ctx.Provider
      value={{
        events,
        eventById,
        createEvent,
        addMessage,
        joinEvent,
        startDinner,
        joinDinner,
        advanceToGenre,
        voteGenre,
        setCandidates,
        voteRestaurant,
        setReservation,
        reset,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useEvents(): EventsApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEvents must be used within EventsProvider');
  return v;
}
