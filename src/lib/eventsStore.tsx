'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  seedEvents,
  eventDinners,
  migrateEvents,
  type Dinner,
  type DinnerCandidate,
  type DinnerReservation,
  type EventAttendee,
  type RoomTierPolicy,
  type RsvpStatus,
  type TravelEvent,
} from './events';
import { uid } from './format';
import { fetchEvents, pushEvents } from './workspaceSync';

// Legacy single-tenant key (default/demo workspace). Real companies use a
// per-company key so events are isolated and sync to the shared server store.
const KEY = 'hv_events_v1';
const eventsKey = (companyId?: string | null) =>
  companyId ? `hv_events_${companyId}` : KEY;

function readActiveCompanyId(): string | undefined {
  try {
    const raw = localStorage.getItem('hv_ent_active_account');
    const acct = raw ? (JSON.parse(raw) as { id?: string }) : null;
    return acct?.id || undefined;
  } catch {
    return undefined;
  }
}

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
    allowHotelList?: { hid: string; name: string }[];
    whitelistOnly?: boolean;
    allowFlights: string[];
    attendees: EventAttendee[];
    regionId?: number;
    lat?: number;
    lng?: number;
    roomTierPolicy?: RoomTierPolicy;
    budget?: number;
    smartPlanning?: boolean;
    /** Group-dinner setup chosen in the create flow. */
    dinnerPlanMode?: 'now' | 'later' | 'none';
    /** For 'later': the date planning should kick off (ISO yyyy-mm-dd). */
    dinnerPlanAt?: string;
    /** Nights (ISO yyyy-mm-dd) to plan a dinner for. Defaults to the first night. */
    dinnerNights?: string[];
  }) => TravelEvent;
  /** Edit an existing event's core details (name, city, dates, attendees,
   *  hotels, flights, budget). Dinner setup is managed from the Dinner tab. */
  updateEvent: (
    id: string,
    data: {
      name: string;
      city: string;
      startDate: string;
      endDate: string;
      allowHotels: string[];
      allowHotelList?: { hid: string; name: string }[];
      whitelistOnly?: boolean;
      allowFlights: string[];
      attendees: EventAttendee[];
      regionId?: number;
      lat?: number;
      lng?: number;
      roomTierPolicy?: RoomTierPolicy;
      budget?: number;
      smartPlanning?: boolean;
      /** Who made the edit, for the event thread note. */
      editorId?: string;
      editorName?: string;
    }
  ) => void;
  addMessage: (
    eventId: string,
    authorId: string,
    author: string,
    text: string,
    replyTo?: string
  ) => void;
  toggleReaction: (eventId: string, messageId: string, userId: string, emoji: string) => void;
  /** Replace an event's smart hotel allow-list (admins). */
  setHotelAllowList: (eventId: string, list: { hid: string; name: string }[]) => void;
  /** Toggle whether this event restricts booking to only its allow-listed hotels. */
  setWhitelistOnly: (eventId: string, on: boolean) => void;
  /** Set the room-tier allow-list policy (admins / host). */
  setRoomTierPolicy: (eventId: string, policy: RoomTierPolicy | undefined) => void;
  /** Set / clear the event hotel budget and smart-planning flag. */
  setEventBudget: (eventId: string, budget: number | undefined, smart: boolean) => void;
  /** A traveler asks a manager to book an additional stay for this event. */
  requestExtraStay: (eventId: string, userId: string, name: string, note?: string) => void;
  /** A manager grants / declines an extra-stay request. */
  resolveExtraStay: (eventId: string, userId: string, grant: boolean) => void;
  joinEvent: (eventId: string, userId: string, name: string) => void;
  /** Cancel an event: marks it cancelled and posts a notice for everyone. The
   *  list hides it 48h later. Returns the attendees to notify by email. */
  cancelEvent: (eventId: string, byName: string) => EventAttendee[];

  /** Add a dinner for a specific night; returns its id. An event may hold one
   *  dinner per night, each with its own RSVP + voting flow. */
  addDinner: (eventId: string, hostId: string, date: string, time: string, expiresAt: string) => string;
  /** Remove a night's dinner (before it's booked). */
  removeDinner: (eventId: string, dinnerId: string) => void;
  joinDinner: (eventId: string, dinnerId: string, userId: string, name: string) => void;
  /** Record an RSVP for one night's dinner (yes adds the person to its party). */
  setRsvp: (eventId: string, dinnerId: string, userId: string, name: string, status: RsvpStatus) => void;
  /** Host nudge: post a reminder naming everyone who hasn't RSVP'd yet. */
  remindRsvp: (eventId: string, hostName: string, pendingNames: string[], date?: string) => void;
  /** Broadcast the final restaurant details for one night's dinner to the group. */
  sendDinnerDetails: (eventId: string, dinnerId: string, author: string) => void;
  advanceToGenre: (eventId: string, dinnerId: string) => void;
  voteGenre: (eventId: string, dinnerId: string, userId: string, genre: string) => void;
  setCandidates: (eventId: string, dinnerId: string, winningGenre: string, candidates: DinnerCandidate[]) => void;
  voteRestaurant: (eventId: string, dinnerId: string, userId: string, restaurantId: string) => void;
  setReservation: (eventId: string, dinnerId: string, reservation: DinnerReservation, author: string) => void;

  reset: () => void;
}

const Ctx = createContext<EventsApi | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<TravelEvent[]>(seedEvents());
  const [hydrated, setHydrated] = useState(false);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const loadedCompanyRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the active company (same source the main workspace uses).
  useEffect(() => {
    const read = () => setCompanyId(readActiveCompanyId());
    read();
    window.addEventListener('hv-account-change', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('hv-account-change', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  // Load this company's events from localStorage (instant), then — for a real
  // company — adopt the shared server copy.
  useEffect(() => {
    const key = eventsKey(companyId);
    const switching = loadedCompanyRef.current !== key;
    if (switching) {
      try {
        const raw = localStorage.getItem(key);
        setEvents(
          migrateEvents(raw ? (JSON.parse(raw) as TravelEvent[]) : companyId ? [] : seedEvents())
        );
      } catch {
        setEvents(companyId ? [] : seedEvents());
      }
      loadedCompanyRef.current = key;
      setHydrated(true);
    }
    if (!companyId) return; // demo workspace stays local-only
    let live = true;
    (async () => {
      const remote = await fetchEvents<TravelEvent>(companyId);
      if (!live || loadedCompanyRef.current !== key) return;
      if (remote) {
        const migrated = migrateEvents(remote);
        setEvents((cur) =>
          JSON.stringify(cur) !== JSON.stringify(migrated) ? migrated : cur
        );
      }
    })();
    return () => {
      live = false;
    };
  }, [companyId]);

  // Persist: localStorage cache + debounced write-through to the shared store.
  useEffect(() => {
    if (!hydrated) return;
    const key = eventsKey(companyId);
    if (loadedCompanyRef.current !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(events));
    } catch {
      /* ignore */
    }
    if (companyId) {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        if (loadedCompanyRef.current === key) void pushEvents(companyId, events);
      }, 1200);
    }
  }, [events, hydrated, companyId]);

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
    const attendees =
      data.attendees.length > 0
        ? data.attendees
        : [{ userId: data.hostId, name: data.hostName }];
    const host = attendees.find((a) => a.userId === data.hostId);

    // "Start now" kicks off RSVPs immediately with sensible defaults (7pm,
    // voting closes in 48h) — one dinner per chosen night, each with its own
    // RSVP + vote. Defaults to the trip's first night. The host can adjust.
    const startNow = data.dinnerPlanMode === 'now';
    const nights =
      data.dinnerNights && data.dinnerNights.length ? data.dinnerNights : [data.startDate];
    const dinners: Dinner[] = startNow
      ? nights.map((night) => ({
          id: uid('din'),
          hostId: data.hostId,
          phase: 'rsvp',
          date: night,
          time: '19:00',
          expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
          attendees: host ? [host] : [],
          rsvps: host ? { [data.hostId]: 'yes' as RsvpStatus } : {},
          genreVotes: {},
          restaurantVotes: {},
          candidates: [],
        }))
      : [];

    const dinnerNote =
      data.dinnerPlanMode === 'now'
        ? dinners.length > 1
          ? ` Group dinner planning has started for ${dinners.length} nights — RSVP for each in the Dinner tab.`
          : ' Group dinner planning has started — RSVP in the Dinner tab.'
        : data.dinnerPlanMode === 'later' && data.dinnerPlanAt
          ? ` Group dinner planning is scheduled to start ${data.dinnerPlanAt}.`
          : '';

    const ev: TravelEvent = {
      id: uid('ev'),
      name: data.name,
      city: data.city,
      startDate: data.startDate,
      endDate: data.endDate,
      hostId: data.hostId,
      attendees,
      allowHotels: data.allowHotels,
      allowHotelList: data.allowHotelList,
      whitelistOnly: data.whitelistOnly,
      allowFlights: data.allowFlights,
      regionId: data.regionId,
      lat: data.lat,
      lng: data.lng,
      roomTierPolicy: data.roomTierPolicy,
      budget: data.budget,
      smartPlanning: data.smartPlanning,
      dinnerPlanMode: data.dinnerPlanMode,
      dinnerPlanAt: data.dinnerPlanMode === 'later' ? data.dinnerPlanAt : undefined,
      dinnerNights: data.dinnerNights,
      dinners: startNow ? dinners : undefined,
      messages: [
        msg(data.hostId, data.hostName, `Created the "${data.name}" event thread.${dinnerNote}`, true),
      ],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setEvents((es) => [ev, ...es]);
    return ev;
  }, []);

  const updateEvent: EventsApi['updateEvent'] = useCallback(
    (id, data) =>
      patch(id, (e) => ({
        ...e,
        name: data.name,
        city: data.city,
        startDate: data.startDate,
        endDate: data.endDate,
        allowHotels: data.allowHotels,
        allowHotelList: data.allowHotelList,
        whitelistOnly: data.whitelistOnly,
        allowFlights: data.allowFlights,
        attendees: data.attendees.length > 0 ? data.attendees : e.attendees,
        regionId: data.regionId,
        lat: data.lat,
        lng: data.lng,
        roomTierPolicy: data.roomTierPolicy,
        budget: data.budget,
        smartPlanning: data.smartPlanning,
        messages: data.editorId
          ? [
              ...e.messages,
              msg(
                data.editorId,
                data.editorName ?? 'An admin',
                `Updated the event details for "${data.name}".`,
                true
              ),
            ]
          : e.messages,
      })),
    [patch]
  );

  const addMessage: EventsApi['addMessage'] = useCallback(
    (eventId, authorId, author, text, replyTo) =>
      patch(eventId, (e) => ({
        ...e,
        messages: [...e.messages, { ...msg(authorId, author, text), replyTo }],
      })),
    [patch]
  );

  const toggleReaction: EventsApi['toggleReaction'] = useCallback(
    (eventId, messageId, userId, emoji) =>
      patch(eventId, (e) => ({
        ...e,
        messages: e.messages.map((m) => {
          if (m.id !== messageId) return m;
          const reactions = { ...(m.reactions ?? {}) };
          const arr = reactions[emoji] ?? [];
          reactions[emoji] = arr.includes(userId)
            ? arr.filter((u) => u !== userId)
            : [...arr, userId];
          if (reactions[emoji].length === 0) delete reactions[emoji];
          return { ...m, reactions };
        }),
      })),
    [patch]
  );

  const setHotelAllowList: EventsApi['setHotelAllowList'] = useCallback(
    (eventId, list) =>
      patch(eventId, (e) => ({
        ...e,
        allowHotelList: list,
        allowHotels: list.map((h) => h.name),
      })),
    [patch]
  );

  const setWhitelistOnly: EventsApi['setWhitelistOnly'] = useCallback(
    (eventId, on) => patch(eventId, (e) => ({ ...e, whitelistOnly: on })),
    [patch]
  );

  const setRoomTierPolicy: EventsApi['setRoomTierPolicy'] = useCallback(
    (eventId, policy) => patch(eventId, (e) => ({ ...e, roomTierPolicy: policy })),
    [patch]
  );

  const setEventBudget: EventsApi['setEventBudget'] = useCallback(
    (eventId, budget, smart) =>
      patch(eventId, (e) => ({ ...e, budget, smartPlanning: smart })),
    [patch]
  );

  const requestExtraStay: EventsApi['requestExtraStay'] = useCallback(
    (eventId, userId, name, note) =>
      patch(eventId, (e) => {
        const others = (e.extraStayRequests ?? []).filter((r) => r.userId !== userId);
        return {
          ...e,
          extraStayRequests: [
            ...others,
            { userId, name, note, requestedAt: new Date().toISOString(), status: 'pending' },
          ],
          messages: [
            ...e.messages,
            msg(userId, name, `${name} requested approval to book an additional stay for this event.`, true),
          ],
        };
      }),
    [patch]
  );

  const resolveExtraStay: EventsApi['resolveExtraStay'] = useCallback(
    (eventId, userId, grant) =>
      patch(eventId, (e) => ({
        ...e,
        extraStayRequests: (e.extraStayRequests ?? []).map((r) =>
          r.userId === userId ? { ...r, status: grant ? 'granted' : 'declined' } : r
        ),
        messages: [
          ...e.messages,
          msg(
            e.hostId,
            'Manager',
            grant
              ? `Approved an additional stay for ${e.extraStayRequests?.find((r) => r.userId === userId)?.name ?? 'a traveler'}.`
              : `Declined the additional-stay request.`,
            true
          ),
        ],
      })),
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

  const cancelEvent: EventsApi['cancelEvent'] = useCallback(
    (eventId, byName) => {
      const ev = events.find((e) => e.id === eventId);
      const recipients = ev ? ev.attendees : [];
      patch(eventId, (e) => ({
        ...e,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        messages: [
          ...e.messages,
          msg(
            e.hostId,
            byName,
            `${byName} cancelled this event. Everyone has been notified by email; any event-only hotel allowances no longer apply.`,
            true
          ),
        ],
      }));
      return recipients;
    },
    [events, patch]
  );

  // All dinner mutations target one dinner by id within e.dinners, migrating a
  // legacy single `dinner` into the array on first write.
  const mapDinner = (e: TravelEvent, dinnerId: string, fn: (d: Dinner) => Dinner): Dinner[] =>
    eventDinners(e).map((d) => (d.id === dinnerId ? fn(d) : d));

  const addDinner: EventsApi['addDinner'] = useCallback(
    (eventId, hostId, date, time, expiresAt) => {
      const id = uid('din');
      patch(eventId, (e) => {
        const host = e.attendees.find((a) => a.userId === hostId);
        const existing = eventDinners(e);
        const dn: Dinner = {
          id,
          hostId,
          phase: 'rsvp',
          date,
          time,
          expiresAt,
          attendees: host ? [host] : [],
          rsvps: host ? { [hostId]: 'yes' as RsvpStatus } : {},
          genreVotes: {},
          restaurantVotes: {},
          candidates: [],
        };
        return {
          ...e,
          dinner: undefined,
          dinners: [...existing, dn],
          messages: [
            ...e.messages,
            msg(
              hostId,
              host?.name ?? 'Host',
              `started planning a group dinner for ${date} at ${time}. Please RSVP in the Dinner tab.`,
              true
            ),
          ],
        };
      });
      return id;
    },
    [patch]
  );

  const removeDinner: EventsApi['removeDinner'] = useCallback(
    (eventId, dinnerId) =>
      patch(eventId, (e) => ({
        ...e,
        dinner: undefined,
        dinners: eventDinners(e).filter((d) => d.id !== dinnerId),
      })),
    [patch]
  );

  const joinDinner: EventsApi['joinDinner'] = useCallback(
    (eventId, dinnerId, userId, name) =>
      patch(eventId, (e) => ({
        ...e,
        dinner: undefined,
        dinners: mapDinner(e, dinnerId, (d) =>
          d.attendees.some((a) => a.userId === userId)
            ? d
            : { ...d, attendees: [...d.attendees, { userId, name }] }
        ),
      })),
    [patch]
  );

  const setRsvp: EventsApi['setRsvp'] = useCallback(
    (eventId, dinnerId, userId, name, status) =>
      patch(eventId, (e) => {
        let flipped = false;
        const dinners = mapDinner(e, dinnerId, (d) => {
          const rsvps = { ...d.rsvps, [userId]: status };
          // "Yes" means you're in the party; anything else removes you from it.
          const attendees =
            status === 'yes'
              ? d.attendees.some((a) => a.userId === userId)
                ? d.attendees
                : [...d.attendees, { userId, name }]
              : d.attendees.filter((a) => a.userId !== userId);
          // As soon as someone's in, open genre voting so people can vote right
          // after they RSVP — no waiting on the host to start it.
          const phase = d.phase === 'rsvp' && status === 'yes' ? 'genre' : d.phase;
          if (phase !== d.phase) flipped = true;
          return { ...d, rsvps, attendees, phase };
        });
        const messages = flipped
          ? [...e.messages, msg(e.hostId, 'HeyVacay', 'Dinner voting is open — pick your food genre!', true)]
          : e.messages;
        return { ...e, dinner: undefined, dinners, messages };
      }),
    [patch]
  );

  const remindRsvp: EventsApi['remindRsvp'] = useCallback(
    (eventId, hostName, pendingNames, date) =>
      patch(eventId, (e) => ({
        ...e,
        messages: [
          ...e.messages,
          msg(
            'system',
            hostName,
            pendingNames.length
              ? `⏰ Reminder to RSVP for the group dinner${date ? ` on ${date}` : ''}: ${pendingNames.join(', ')}.`
              : `⏰ Reminder: please RSVP for the group dinner${date ? ` on ${date}` : ''}.`,
            true
          ),
        ],
      })),
    [patch]
  );

  const sendDinnerDetails: EventsApi['sendDinnerDetails'] = useCallback(
    (eventId, dinnerId, author) =>
      patch(eventId, (e) => {
        const r = eventDinners(e).find((d) => d.id === dinnerId)?.reservation;
        if (!r) return e;
        return {
          ...e,
          dinner: undefined,
          dinners: mapDinner(e, dinnerId, (d) => ({ ...d, detailsSent: true })),
          messages: [
            ...e.messages,
            msg(
              'system',
              author,
              `📍 Dinner is set — ${r.restaurantName} on ${r.date} at ${r.time}, party of ${r.partySize}. Confirmation ${r.confirmation}. See everyone there!`,
              true
            ),
          ],
        };
      }),
    [patch]
  );

  const advanceToGenre: EventsApi['advanceToGenre'] = useCallback(
    (eventId, dinnerId) =>
      patch(eventId, (e) => ({
        ...e,
        dinner: undefined,
        dinners: mapDinner(e, dinnerId, (d) => ({ ...d, phase: 'genre' })),
      })),
    [patch]
  );

  const voteGenre: EventsApi['voteGenre'] = useCallback(
    (eventId, dinnerId, userId, genre) =>
      patch(eventId, (e) => ({
        ...e,
        dinner: undefined,
        dinners: mapDinner(e, dinnerId, (d) => ({
          ...d,
          genreVotes: { ...d.genreVotes, [userId]: genre },
        })),
      })),
    [patch]
  );

  const setCandidates: EventsApi['setCandidates'] = useCallback(
    (eventId, dinnerId, winningGenre, candidates) =>
      patch(eventId, (e) => ({
        ...e,
        dinner: undefined,
        dinners: mapDinner(e, dinnerId, (d) => ({ ...d, phase: 'restaurant', winningGenre, candidates })),
      })),
    [patch]
  );

  const voteRestaurant: EventsApi['voteRestaurant'] = useCallback(
    (eventId, dinnerId, userId, restaurantId) =>
      patch(eventId, (e) => ({
        ...e,
        dinner: undefined,
        dinners: mapDinner(e, dinnerId, (d) => ({
          ...d,
          restaurantVotes: { ...d.restaurantVotes, [userId]: restaurantId },
        })),
      })),
    [patch]
  );

  const setReservation: EventsApi['setReservation'] = useCallback(
    (eventId, dinnerId, reservation, author) =>
      patch(eventId, (e) => ({
        ...e,
        dinner: undefined,
        dinners: mapDinner(e, dinnerId, (d) => ({ ...d, phase: 'booked', reservation })),
        messages: [
          ...e.messages,
          msg(
            'system',
            author,
            `🍽️ Group dinner booked — ${reservation.restaurantName} on ${reservation.date} at ${reservation.time} for ${reservation.partySize}. Confirmation ${reservation.confirmation}.`,
            true
          ),
        ],
      })),
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
        updateEvent,
        addMessage,
        toggleReaction,
        setHotelAllowList,
        setWhitelistOnly,
        setRoomTierPolicy,
        setEventBudget,
        requestExtraStay,
        resolveExtraStay,
        joinEvent,
        cancelEvent,
        addDinner,
        removeDinner,
        joinDinner,
        setRsvp,
        remindRsvp,
        sendDinnerDetails,
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
