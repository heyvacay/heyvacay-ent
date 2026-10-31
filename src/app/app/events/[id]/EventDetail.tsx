'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useEvents } from '@/lib/eventsStore';
import {
  FOOD_GENRES,
  ROOM_TIERS,
  dinnerExpired,
  tally,
  winner,
  type DinnerCandidate,
  type DinnerPhase,
  type EventAttendee,
  type RoomTier,
  type OverTierAction,
  type RsvpStatus,
} from '@/lib/events';
import { estimateEventSpend } from '@/lib/eventPlanning';
import { getAvailability, bookRestaurant, searchRestaurants } from '@/lib/restaurants';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  cn,
} from '@/components/app/ui';
import { shortDate, money, todayISO } from '@/lib/format';
import { hotelNeed } from '@/lib/hotelNeed';
import { EventChat } from '@/components/app/EventChat';
import { HotelAllowPicker } from '@/components/app/HotelAllowPicker';
import { sendEmail } from '@/lib/email';
import { MapPin, Users, Check, Shield, Plane, Sparkles } from '@/components/icons';

type Tab = 'overview' | 'chat' | 'dinner';

export default function EventDetail({ id }: { id: string }) {
  const { state, activeUser, role } = useStore();
  const emailById = (userId: string) => state.users.find((u) => u.id === userId)?.email;
  const {
    eventById,
    addMessage,
    toggleReaction,
    setHotelAllowList,
    setWhitelistOnly,
    setRoomTierPolicy,
    setEventBudget,
    resolveExtraStay,
    joinEvent,
    startDinner,
    joinDinner,
    setRsvp,
    remindRsvp,
    sendDinnerDetails,
    advanceToGenre,
    voteGenre,
    setCandidates,
    voteRestaurant,
    setReservation,
  } = useEvents();
  const e = eventById(id);
  const initialTab =
    typeof window !== 'undefined'
      ? ((new URLSearchParams(window.location.search).get('tab') as Tab) ?? 'overview')
      : 'overview';
  const [tab, setTab] = useState<Tab>(
    initialTab === 'dinner' || initialTab === 'chat' ? initialTab : 'overview'
  );
  const [booking, setBooking] = useState(false);
  const [availNote, setAvailNote] = useState('');
  const bookedRef = useRef(false);

  const isAttendee = !!e?.attendees.some((a) => a.userId === activeUser.id);
  const d = e?.dinner;
  const isHost = d?.hostId === activeUser.id;

  // Load candidate restaurants once the genre vote is tallied.
  const pickRestaurants = async () => {
    if (!e || !d) return;
    const g = winner(d.genreVotes) ?? FOOD_GENRES[0];
    const results = await searchRestaurants(e.city, g);
    const candidates: DinnerCandidate[] = results.slice(0, 6).map((r) => ({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      genre: r.genre,
      image: r.image,
      rating: r.rating,
      priceBand: r.priceBand,
      neighborhood: r.neighborhood,
    }));
    setCandidates(e.id, g, candidates);
  };

  const bookWinner = async () => {
    if (!e || !d || booking) return;
    setBooking(true);
    try {
      const winnerId = winner(d.restaurantVotes) ?? d.candidates[0]?.id;
      const rest = d.candidates.find((c) => c.id === winnerId);
      if (!rest) return;
      const party = d.attendees.length || 2;
      const avail = await getAvailability({
        restaurantId: rest.id,
        date: d.date,
        time: d.time,
        partySize: party,
      });
      let bookTime = d.time;
      if (avail && !avail.requestedAvailable) {
        bookTime = avail.slots[0]?.time || d.time;
        setAvailNote(`Requested ${d.time} wasn't available — booked the closest open time, ${bookTime}.`);
      }
      const r = await bookRestaurant({
        restaurantId: rest.id,
        date: d.date,
        time: bookTime,
        partySize: party,
        name: e.name,
      });
      if (r) {
        setReservation(
          e.id,
          {
            confirmation: r.confirmation,
            restaurantId: rest.id,
            restaurantName: rest.name,
            time: bookTime,
            date: d.date,
            partySize: party,
          },
          activeUser.name
        );
        // Email everyone who's coming the final reservation details.
        d.attendees.forEach((a) => {
          const email = emailById(a.userId);
          if (email)
            sendEmail('dinnerBooked', email, {
              name: a.name,
              restaurant: rest.name,
              date: d.date,
              time: bookTime,
              partySize: party,
              confirmation: r.confirmation,
            });
        });
      }
    } finally {
      setBooking(false);
    }
  };

  // Auto-book when the host's expiration passes (runs once).
  useEffect(() => {
    if (!d || bookedRef.current) return;
    if (d.phase === 'restaurant' && dinnerExpired(d, new Date().toISOString())) {
      bookedRef.current = true;
      void bookWinner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.phase]);

  // Auto-start a dinner that was scheduled for "later" once its start day
  // arrives. Whoever opens the event on/after that day kicks it off (client
  // prototype — on the real backend a scheduled job would do this).
  const scheduledStartedRef = useRef(false);
  useEffect(() => {
    if (!e || e.dinner || scheduledStartedRef.current) return;
    if (e.dinnerPlanMode !== 'later' || !e.dinnerPlanAt) return;
    if (todayISO() < e.dinnerPlanAt) return;
    scheduledStartedRef.current = true;
    const time = '19:00';
    const expiresAt = new Date(Date.now() + 48 * 3600_000).toISOString();
    startDinner(e.id, e.hostId, e.startDate, time, expiresAt);
    e.attendees.forEach((a) => {
      const email = emailById(a.userId);
      if (email && a.userId !== e.hostId)
        sendEmail('dinnerInvite', email, {
          name: a.name,
          event: e.name,
          date: e.startDate,
          time,
          city: e.city,
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.id, e?.dinner, e?.dinnerPlanMode, e?.dinnerPlanAt]);

  if (!e) {
    return (
      <div>
        <Link href="/app/events" className="text-sm font-medium text-brand-dark hover:underline">
          ← All events
        </Link>
        <div className="mt-4">
          <EmptyState title="Event not found" sub="It may have been removed." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/app/events" className="text-sm font-medium text-brand-dark hover:underline">
        ← All events
      </Link>
      <section className="relative mt-3 overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-surface to-navy-deep p-6 text-white ring-1 ring-white/10 sm:p-7">
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/25 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Company event</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              {e.name}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mist/80">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {e.city}
              </span>
              <span>
                {shortDate(e.startDate)}–{shortDate(e.endDate)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" /> {e.attendees.length} attending
              </span>
            </p>
            <div className="mt-3 flex items-center -space-x-2">
              {e.attendees.slice(0, 7).map((a) => (
                <span
                  key={a.userId}
                  title={a.name}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-white ring-2 ring-navy"
                >
                  {a.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                </span>
              ))}
              {e.attendees.length > 7 && (
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-white ring-2 ring-navy">
                  +{e.attendees.length - 7}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {d ? (
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  d.phase === 'booked' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'
                )}
              >
                {d.phase === 'booked' ? 'Dinner booked' : 'Dinner planning'}
              </span>
            ) : (
              e.dinnerPlanMode === 'later' &&
              e.dinnerPlanAt && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-mist">
                  Dinner {shortDate(e.dinnerPlanAt)}
                </span>
              )
            )}
            {!isAttendee ? (
              <Button onClick={() => joinEvent(e.id, activeUser.id, activeUser.name)}>
                Join event
              </Button>
            ) : (
              <Button href={`/app/book?eventId=${e.id}`}>Book travel</Button>
            )}
          </div>
        </div>
      </section>

      <div className="mt-5" />

      <div className="mb-5 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {(['overview', 'chat', 'dinner'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors',
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            )}
          >
            {t}
            {t === 'chat' && ` (${e.messages.filter((m) => !m.system).length})`}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Allowed travel</h2>
              <p className="mb-3 text-xs text-slate-400">
                Bookings outside these need admin approval, so everyone stays together and in budget.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <MapPin className="h-4 w-4 text-brand-dark" /> Hotels
                  </p>
                  {role === 'admin' ? (
                    <>
                      <HotelAllowPicker
                        value={e.allowHotelList ?? []}
                        onChange={(list) => setHotelAllowList(e.id, list)}
                      />
                      <label
                        className={cn(
                          'mt-2 flex items-start gap-2 text-xs',
                          (e.allowHotelList?.length ?? 0) === 0 && 'opacity-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!!e.whitelistOnly}
                          disabled={(e.allowHotelList?.length ?? 0) === 0}
                          onChange={(ev) => setWhitelistOnly(e.id, ev.target.checked)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand"
                        />
                        <span className="text-slate-600">
                          Only allow these hotels (travelers can&apos;t book elsewhere for this event)
                        </span>
                      </label>
                    </>
                  ) : (e.allowHotelList?.length ?? e.allowHotels.length) === 0 ? (
                    <p className="text-sm text-slate-400">No restriction</p>
                  ) : (
                    <ul className="space-y-1">
                      {(e.allowHotelList?.map((h) => h.name) ?? e.allowHotels).map((h) => (
                        <li key={h} className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Check className="h-3.5 w-3.5 text-brand-dark" /> {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Plane className="h-4 w-4 text-brand-dark" /> Flights
                  </p>
                  {e.allowFlights.length === 0 ? (
                    <p className="text-sm text-slate-400">No restriction</p>
                  ) : (
                    <ul className="space-y-1">
                      {e.allowFlights.map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Check className="h-3.5 w-3.5 text-brand-dark" /> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          </div>
          <RoomPolicyCard
            e={e}
            isAdmin={role === 'admin'}
            users={state.users}
            setRoomTierPolicy={setRoomTierPolicy}
            setEventBudget={setEventBudget}
          />

          {/* extra-stay approvals (admin/host) */}
          {(role === 'admin' || isHost) &&
            (e.extraStayRequests?.some((r) => r.status === 'pending') ?? false) && (
              <Card>
                <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
                  Additional-stay requests
                </h2>
                <p className="mb-3 text-xs text-slate-400">
                  These travelers already booked a hotel for this event and are asking to book another
                  stay.
                </p>
                <div className="space-y-2">
                  {e.extraStayRequests
                    ?.filter((r) => r.status === 'pending')
                    .map((r) => (
                      <div
                        key={r.userId}
                        className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3"
                      >
                        <span className="flex-1 text-sm font-medium text-amber-800">{r.name}</span>
                        <Button size="sm" onClick={() => resolveExtraStay(e.id, r.userId, true)}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveExtraStay(e.id, r.userId, false)}
                        >
                          Decline
                        </Button>
                      </div>
                    ))}
                </div>
              </Card>
            )}

          <Card>
            <h2 className="mb-1 font-display text-lg font-bold text-slate-900">Attendees</h2>
            <p className="mb-3 text-xs text-slate-400">
              Hotel status is based on each person&apos;s home city (&gt;50mi needs a hotel).
            </p>
            <div className="space-y-2">
              {e.attendees.map((a) => {
                const u = state.users.find((x) => x.id === a.userId);
                const hasHotel = state.bookings.some(
                  (b) =>
                    b.eventId === e.id &&
                    b.type === 'hotel' &&
                    b.status !== 'cancelled' &&
                    b.travelerId === a.userId
                );
                const needsHotel = hotelNeed({
                  homeCity: u?.homeCity,
                  homeLat: u?.homeLat,
                  homeLng: u?.homeLng,
                  eventCity: e.city,
                  eventLat: e.lat,
                  eventLng: e.lng,
                }).needs;
                return (
                  <div key={a.userId} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                      {a.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                    </span>
                    <span className="flex-1 truncate">{a.name}</span>
                    {a.userId === e.hostId && <Badge color="brand">Host</Badge>}
                    {hasHotel ? (
                      <Badge color="green">Hotel booked</Badge>
                    ) : needsHotel ? (
                      <Badge color="amber">Needs hotel</Badge>
                    ) : (
                      <Badge color="slate">Local</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === 'chat' && (
        <EventChat
          messages={e.messages}
          activeUserId={activeUser.id}
          onSend={(text, replyTo) => addMessage(e.id, activeUser.id, activeUser.name, text, replyTo)}
          onReact={(mid, emoji) => toggleReaction(e.id, mid, activeUser.id, emoji)}
        />
      )}

      {tab === 'dinner' && (
        <DinnerPanel
          e={e}
          d={d}
          isHost={isHost}
          isAttendee={isAttendee}
          activeUserId={activeUser.id}
          activeUserName={activeUser.name}
          booking={booking}
          availNote={availNote}
          eventAttendees={e.attendees}
          onStart={(date, time, expiresAt) => {
            startDinner(e.id, activeUser.id, date, time, expiresAt);
            // Invite every attendee to RSVP.
            e.attendees.forEach((a) => {
              const email = emailById(a.userId);
              if (email && a.userId !== activeUser.id)
                sendEmail('dinnerInvite', email, {
                  name: a.name,
                  event: e.name,
                  date,
                  time,
                  city: e.city,
                });
            });
          }}
          onJoin={() => joinDinner(e.id, activeUser.id, activeUser.name)}
          onRsvp={(status) => setRsvp(e.id, activeUser.id, activeUser.name, status)}
          onRemind={(pending) => {
            remindRsvp(e.id, activeUser.name, pending);
            // Email everyone who hasn't replied yet.
            const rsvps = e.dinner?.rsvps ?? {};
            e.attendees
              .filter((a) => !rsvps[a.userId])
              .forEach((a) => {
                const email = emailById(a.userId);
                if (email) sendEmail('dinnerReminder', email, { name: a.name, event: e.name });
              });
          }}
          onSendDetails={() => sendDinnerDetails(e.id, activeUser.name)}
          onStartGenre={() => advanceToGenre(e.id)}
          onVoteGenre={(g) => {
            voteGenre(e.id, activeUser.id, g);
            addMessage(e.id, activeUser.id, activeUser.name, `🍽️ voted for ${g}`);
          }}
          onPickRestaurants={pickRestaurants}
          onVoteRestaurant={(rid) => {
            voteRestaurant(e.id, activeUser.id, rid);
            const r = d?.candidates.find((c) => c.id === rid);
            addMessage(e.id, activeUser.id, activeUser.name, `🍽️ voted for ${r?.name ?? 'a restaurant'}`);
          }}
          onBook={bookWinner}
        />
      )}
    </div>
  );
}

/* ---------------- dinner panel ---------------- */

/** The group-dinner flow, as plain-English steps for the progress bar. */
const DINNER_STEPS = [
  { key: 'rsvp', label: 'RSVP' },
  { key: 'genre', label: 'Pick cuisine' },
  { key: 'restaurant', label: 'Pick spot' },
  { key: 'booked', label: 'Booked' },
] as const;

function dinnerStepIndex(phase: DinnerPhase): number {
  switch (phase) {
    case 'rsvp':
    case 'join':
      return 0;
    case 'genre':
      return 1;
    case 'restaurant':
      return 2;
    case 'booked':
      return 3;
  }
}

function dinnerPhaseLabel(phase: DinnerPhase): string {
  return ['Collecting RSVPs', 'Voting on cuisine', 'Voting on the spot', 'Booked'][
    dinnerStepIndex(phase)
  ];
}

/** Horizontal RSVP → Pick cuisine → Pick spot → Booked progress bar. */
function DinnerStepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center">
      {DINNER_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                  active
                    ? 'bg-brand text-navy-deep'
                    : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-xs font-semibold',
                  active ? 'text-slate-900' : done ? 'text-emerald-600' : 'text-slate-400'
                )}
              >
                {s.label}
              </span>
            </div>
            {i < DINNER_STEPS.length - 1 && (
              <span className={cn('mx-2 h-px w-5 sm:w-8', done ? 'bg-emerald-400' : 'bg-slate-200')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function DinnerPanel({
  e,
  d,
  isHost,
  isAttendee,
  activeUserId,
  booking,
  availNote,
  eventAttendees,
  onStart,
  onRsvp,
  onRemind,
  onSendDetails,
  onStartGenre,
  onVoteGenre,
  onPickRestaurants,
  onVoteRestaurant,
  onBook,
}: {
  e: ReturnType<typeof useEvents>['events'][number];
  d: ReturnType<typeof useEvents>['events'][number]['dinner'];
  isHost: boolean;
  isAttendee: boolean;
  activeUserId: string;
  activeUserName: string;
  booking: boolean;
  availNote: string;
  eventAttendees: EventAttendee[];
  onStart: (date: string, time: string, expiresAt: string) => void;
  onJoin: () => void;
  onRsvp: (status: RsvpStatus) => void;
  onRemind: (pendingNames: string[]) => void;
  onSendDetails: () => void;
  onStartGenre: () => void;
  onVoteGenre: (g: string) => void;
  onPickRestaurants: () => void;
  onVoteRestaurant: (rid: string) => void;
  onBook: () => void;
}) {
  const [date, setDate] = useState(e.startDate);
  const [time, setTime] = useState('19:00');
  const [hours, setHours] = useState(2);

  if (!d) {
    const scheduled =
      e.dinnerPlanMode === 'later' && e.dinnerPlanAt && todayISO() < e.dinnerPlanAt
        ? e.dinnerPlanAt
        : null;
    return (
      <div className="space-y-5">
        {/* how it works — the whole flow at a glance */}
        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-brand-dark" /> Plan a group dinner
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            HeyVacay runs the whole thing in four simple steps — you just kick it off and we handle
            the rest.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {(
              [
                ['1', 'RSVP', 'Everyone says whether they’re coming.'],
                ['2', 'Pick cuisine', 'The group votes on a type of food.'],
                ['3', 'Pick spot', `Vote between real restaurants in ${e.city}.`],
                ['4', 'Booked', 'The winner is reserved and details go out.'],
              ] as [string, string, string][]
            ).map(([n, t, dsc]) => (
              <div key={n} className="rounded-xl border border-slate-200 p-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand-dark">
                  {n}
                </span>
                <p className="mt-2 text-sm font-semibold text-slate-800">{t}</p>
                <p className="mt-0.5 text-xs text-slate-500">{dsc}</p>
              </div>
            ))}
          </div>
        </Card>

        {scheduled && (
          <Card className="border-brand/30 bg-brand/5">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Check className="h-4 w-4 text-brand-dark" /> Scheduled to start {shortDate(scheduled)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              We&apos;ll send RSVP requests to everyone automatically that day — far enough ahead to
              plan, close enough that people know their schedule. You can also start it now below.
            </p>
          </Card>
        )}

        <Card>
          <h3 className="mb-1 font-display text-base font-bold text-slate-900">
            {scheduled ? 'Start it now instead' : 'Start dinner planning'}
          </h3>
          <p className="mb-4 text-sm text-slate-500">
            Set the date and time, and how long the group gets to vote. When voting closes, the
            top-voted restaurant is booked automatically — nobody has to remember to do it.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Dinner date">
              <Input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
            </Field>
            <Field label="Dinner time">
              <Input type="time" value={time} onChange={(ev) => setTime(ev.target.value)} />
            </Field>
            <Field label="Voting closes in">
              <Select value={hours} onChange={(ev) => setHours(Number(ev.target.value))}>
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={4}>4 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </Select>
            </Field>
          </div>
          <Button
            className="mt-4"
            onClick={() =>
              onStart(date, time, new Date(Date.now() + hours * 3600_000).toISOString())
            }
          >
            {scheduled ? 'Start now' : 'Start dinner planning'}
          </Button>
        </Card>
      </div>
    );
  }

  const joined = d.attendees.some((a) => a.userId === activeUserId);
  const rsvps = d.rsvps ?? {};
  const myRsvp = rsvps[activeUserId];
  const yesCount = Object.values(rsvps).filter((r) => r === 'yes').length;
  const noCount = Object.values(rsvps).filter((r) => r === 'no').length;
  const maybeCount = Object.values(rsvps).filter((r) => r === 'maybe').length;
  const pending = eventAttendees.filter((a) => !rsvps[a.userId]);
  const genreTally = tally(d.genreVotes);
  const restTally = tally(d.restaurantVotes);
  const expiresLabel = new Date(d.expiresAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-lg font-bold text-slate-900">
              Group dinner · {shortDate(d.date)} at {d.time}
            </p>
            <p className="text-sm text-slate-400">
              {yesCount} coming · {maybeCount} maybe · {noCount} can&apos;t make it
            </p>
          </div>
          <Badge color={d.phase === 'booked' ? 'green' : 'amber'}>{dinnerPhaseLabel(d.phase)}</Badge>
        </div>

        <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-4">
          <DinnerStepper current={dinnerStepIndex(d.phase)} />
        </div>

        {d.phase === 'restaurant' && (
          <p className="mt-3 text-xs text-slate-500">
            Voting closes {expiresLabel} — the most-voted restaurant books automatically then, so no
            one has to chase it down.
          </p>
        )}

        {availNote && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {availNote}
          </p>
        )}
      </Card>

      {/* RSVP */}
      {(d.phase === 'rsvp' || d.phase === 'join') && (
        <Card>
          <h3 className="mb-1 font-display text-base font-bold text-slate-900">
            Step 1 · Can you make it?
          </h3>
          <p className="mb-3 text-sm text-slate-500">
            RSVP so we know the headcount. Once the host closes RSVPs, everyone who&apos;s in votes
            on the cuisine and the spot.
          </p>

          {isAttendee && (
            <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
              {(
                [
                  ['yes', "I'm in"],
                  ['maybe', 'Maybe'],
                  ['no', "Can't make it"],
                ] as [RsvpStatus, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => onRsvp(v)}
                  className={cn(
                    'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
                    myRsvp === v
                      ? v === 'yes'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : v === 'no'
                          ? 'bg-slate-500 text-white shadow-sm'
                          : 'bg-amber-400 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {yesCount > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Coming
                </span>
                {d.attendees.map((a) => (
                  <span
                    key={a.userId}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700"
                  >
                    <Check className="h-3 w-3" /> {a.name}
                  </span>
                ))}
              </div>
            )}
            {pending.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  No reply yet
                </span>
                {pending.map((a) => (
                  <span
                    key={a.userId}
                    className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500"
                  >
                    {a.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {isHost && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => onRemind(pending.map((a) => a.name))}
                disabled={pending.length === 0}
              >
                Remind to RSVP
              </Button>
              <Button onClick={onStartGenre} disabled={yesCount < 1}>
                Close RSVPs &amp; start cuisine vote →
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* GENRE VOTE */}
      {d.phase === 'genre' && (
        <Card>
          <h3 className="mb-1 font-display text-base font-bold text-slate-900">
            Step 2 · What are we in the mood for?
          </h3>
          <p className="mb-3 text-sm text-slate-500">
            Vote on a cuisine. The winner decides which restaurants you&apos;ll choose between next.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FOOD_GENRES.map((g) => {
              const count = genreTally.find((t) => t.key === g)?.count ?? 0;
              const mine = d.genreVotes[activeUserId] === g;
              return (
                <button
                  key={g}
                  onClick={() => joined && onVoteGenre(g)}
                  disabled={!joined}
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition',
                    mine ? 'border-brand bg-brand/10 text-brand-dark' : 'border-slate-200 text-slate-700 hover:border-slate-300',
                    !joined && 'opacity-50'
                  )}
                >
                  {g}
                  {count > 0 && <span className="text-xs font-semibold text-slate-400">{count}</span>}
                </button>
              );
            })}
          </div>
          {!joined && <p className="mt-2 text-xs text-slate-400">Join the dinner to vote.</p>}
          {isHost && (
            <Button className="mt-4" onClick={onPickRestaurants} disabled={genreTally.length === 0}>
              Close cuisine vote &amp; show restaurants →
            </Button>
          )}
        </Card>
      )}

      {/* RESTAURANT VOTE */}
      {d.phase === 'restaurant' && (
        <Card>
          <h3 className="mb-1 font-display text-base font-bold text-slate-900">
            Step 3 · Vote for a {d.winningGenre} spot in {e.city}
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            Tap a restaurant to vote — change it any time before voting closes.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.candidates.map((c) => {
              const count = restTally.find((t) => t.key === c.id)?.count ?? 0;
              const mine = d.restaurantVotes[activeUserId] === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => joined && onVoteRestaurant(c.id)}
                  disabled={!joined}
                  className={cn(
                    'flex gap-3 overflow-hidden rounded-xl border p-2 text-left transition',
                    mine ? 'border-brand ring-1 ring-brand' : 'border-slate-200 hover:border-slate-300',
                    !joined && 'opacity-50'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image} alt={c.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                    <p className="truncate text-xs text-slate-400">{c.cuisine} · ★ {c.rating}</p>
                    <p className="text-xs text-slate-400">{'$'.repeat(c.priceBand)} · {c.neighborhood}</p>
                  </div>
                  <span className="self-center text-sm font-bold text-brand-dark">{count || ''}</span>
                </button>
              );
            })}
          </div>
          {isHost && (
            <Button className="mt-4" onClick={onBook} disabled={booking || restTally.length === 0}>
              {booking ? 'Booking…' : 'Book winner now'}
            </Button>
          )}
        </Card>
      )}

      {/* BOOKED */}
      {d.phase === 'booked' && d.reservation && (
        <Card className="border-emerald-200 bg-emerald-50">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-emerald-800">
            <Check className="h-5 w-5" /> Dinner booked
          </h3>
          <p className="mt-1 text-sm text-emerald-700">
            {d.reservation.restaurantName} · {shortDate(d.reservation.date)} at {d.reservation.time} ·
            party of {d.reservation.partySize}
          </p>
          <p className="mt-1 text-xs text-emerald-600">Confirmation {d.reservation.confirmation}</p>
          {isHost && (
            <Button
              className="mt-4"
              variant="outline"
              onClick={onSendDetails}
              disabled={d.detailsSent}
            >
              {d.detailsSent ? 'Details sent ✓' : 'Send details to the group'}
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}

/* ---------------- room-tier policy & budget ---------------- */

function RoomPolicyCard({
  e,
  isAdmin,
  users,
  setRoomTierPolicy,
  setEventBudget,
}: {
  e: ReturnType<typeof useEvents>['events'][number];
  isAdmin: boolean;
  users: ReturnType<typeof useStore>['state']['users'];
  setRoomTierPolicy: ReturnType<typeof useEvents>['setRoomTierPolicy'];
  setEventBudget: ReturnType<typeof useEvents>['setEventBudget'];
}) {
  const policy = e.roomTierPolicy;
  // Headcount needing a hotel (home >50mi, or unknown).
  const hotelHeadcount = e.attendees.filter((a) => {
    const u = users.find((x) => x.id === a.userId);
    return hotelNeed({
      homeCity: u?.homeCity,
      homeLat: u?.homeLat,
      homeLng: u?.homeLng,
      eventCity: e.city,
      eventLat: e.lat,
      eventLng: e.lng,
    }).needs;
  }).length;
  const nights = Math.max(
    1,
    Math.round((new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / 86400000)
  );
  const base: RoomTier = policy?.base ?? 'Standard';
  const est = estimateEventSpend({ hotelHeadcount, flightHeadcount: hotelHeadcount, nights, tier: base });
  const overLabel: Record<OverTierAction, string> = {
    block: 'Blocked',
    manager: 'Needs manager approval',
    host: 'Needs event-host approval',
  };

  const update = (patch: Partial<NonNullable<typeof policy>>) =>
    setRoomTierPolicy(e.id, {
      base: policy?.base ?? 'Standard',
      byPosition: policy?.byPosition ?? [],
      overAction: policy?.overAction ?? 'manager',
      ...patch,
    });

  return (
    <Card>
      <h2 className="mb-1 font-display text-lg font-bold text-slate-900">Room policy &amp; budget</h2>
      <p className="mb-3 text-xs text-slate-400">
        The room tiers this event allows, and the live cost estimate for the people staying.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-400">Base room tier</p>
          {isAdmin ? (
            <Select
              className="mt-1"
              value={base}
              onChange={(ev) => update({ base: ev.target.value as RoomTier })}
            >
              {ROOM_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          ) : (
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{base} or lower</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-400">If someone books higher</p>
          {isAdmin ? (
            <Select
              className="mt-1"
              value={policy?.overAction ?? 'manager'}
              onChange={(ev) => update({ overAction: ev.target.value as OverTierAction })}
            >
              <option value="block">Block it</option>
              <option value="manager">Require manager approval</option>
              <option value="host">Require event-host approval</option>
            </Select>
          ) : (
            <p className="mt-0.5 text-sm font-semibold text-slate-800">
              {overLabel[policy?.overAction ?? 'manager']}
            </p>
          )}
        </div>
      </div>

      {policy?.byPosition && policy.byPosition.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-400">Higher tiers by position</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {policy.byPosition.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {r.position} → up to {r.maxTier}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-brand-dark" /> Estimated spend
          </p>
          <p className="font-display text-lg font-bold text-brand-dark">{money(est.total)}</p>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {hotelHeadcount} staying · {nights} night{nights === 1 ? '' : 's'} · hotels {money(est.hotel)} ·
          flights {money(est.flights)}.
          {e.budget != null &&
            (est.total > e.budget
              ? ` About ${money(est.total - e.budget)} over the ${money(e.budget)} budget.`
              : ` Within the ${money(e.budget)} budget.`)}
          {e.smartPlanning ? ' Smart planning is on.' : ''}
        </p>
        {isAdmin && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              defaultValue={e.budget ?? ''}
              placeholder="Set budget (USD)"
              onBlur={(ev) =>
                setEventBudget(
                  e.id,
                  ev.target.value ? Number(ev.target.value) : undefined,
                  !!e.smartPlanning
                )
              }
              className="w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand"
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={!!e.smartPlanning}
                onChange={(ev) => setEventBudget(e.id, e.budget, ev.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              Smart planning
            </label>
          </div>
        )}
      </div>
    </Card>
  );
}
