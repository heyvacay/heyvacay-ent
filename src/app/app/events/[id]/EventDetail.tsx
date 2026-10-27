'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useEvents } from '@/lib/eventsStore';
import {
  FOOD_GENRES,
  dinnerExpired,
  tally,
  winner,
  type DinnerCandidate,
  type EventAttendee,
  type RsvpStatus,
} from '@/lib/events';
import { getAvailability, bookRestaurant, searchRestaurants } from '@/lib/restaurants';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  cn,
} from '@/components/app/ui';
import { shortDate } from '@/lib/format';
import { MapPin, Users, Check, Shield, Plane, Sparkles } from '@/components/icons';

type Tab = 'overview' | 'chat' | 'dinner';

export default function EventDetail({ id }: { id: string }) {
  const { activeUser } = useStore();
  const {
    eventById,
    addMessage,
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
  const [tab, setTab] = useState<Tab>('overview');
  const [msg, setMsg] = useState('');
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

  const send = () => {
    if (!msg.trim()) return;
    addMessage(e.id, activeUser.id, activeUser.name, msg.trim());
    setMsg('');
  };

  return (
    <div>
      <Link href="/app/events" className="text-sm font-medium text-brand-dark hover:underline">
        ← All events
      </Link>
      <PageHeader
        title={e.name}
        subtitle={`${e.city} · ${shortDate(e.startDate)}–${shortDate(e.endDate)} · ${e.attendees.length} attending`}
        actions={
          !isAttendee ? (
            <Button onClick={() => joinEvent(e.id, activeUser.id, activeUser.name)}>Join event</Button>
          ) : undefined
        }
      />

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
                  {e.allowHotels.length === 0 ? (
                    <p className="text-sm text-slate-400">No restriction</p>
                  ) : (
                    <ul className="space-y-1">
                      {e.allowHotels.map((h) => (
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
          <Card>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Attendees</h2>
            <div className="space-y-2">
              {e.attendees.map((a) => (
                <div key={a.userId} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                    {a.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                  </span>
                  {a.name}
                  {a.userId === e.hostId && <Badge color="brand">Host</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'chat' && (
        <Card pad={false} className="flex h-[60vh] flex-col">
          <div className="flex-1 space-y-3 overflow-auto p-4">
            {e.messages.map((m) =>
              m.system ? (
                <p key={m.id} className="text-center text-xs text-slate-400">
                  {m.text}
                </p>
              ) : (
                <div key={m.id} className={cn('flex', m.authorId === activeUser.id && 'justify-end')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                      m.authorId === activeUser.id
                        ? 'bg-brand text-navy-deep'
                        : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    {m.authorId !== activeUser.id && (
                      <p className="mb-0.5 text-xs font-semibold text-slate-500">{m.author}</p>
                    )}
                    {m.text}
                  </div>
                </div>
              )
            )}
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-3">
            <input
              value={msg}
              onChange={(ev) => setMsg(ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && send()}
              placeholder="Message the group…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <Button onClick={send}>Send</Button>
          </div>
        </Card>
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
          onStart={(date, time, expiresAt) => startDinner(e.id, activeUser.id, date, time, expiresAt)}
          onJoin={() => joinDinner(e.id, activeUser.id, activeUser.name)}
          onRsvp={(status) => setRsvp(e.id, activeUser.id, activeUser.name, status)}
          onRemind={(pending) => remindRsvp(e.id, activeUser.name, pending)}
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
    return (
      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
          <Sparkles className="h-5 w-5 text-brand-dark" /> Plan a group dinner
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Collect RSVPs from the group, nudge anyone who hasn&apos;t replied, then about a week out
          pick the spot and send everyone the details.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date">
            <Input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
          </Field>
          <Field label="Time">
            <Input type="time" value={time} onChange={(ev) => setTime(ev.target.value)} />
          </Field>
          <Field label="Auto-book in">
            <Select value={hours} onChange={(ev) => setHours(Number(ev.target.value))}>
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={4}>4 hours</option>
              <option value={24}>24 hours</option>
            </Select>
          </Field>
        </div>
        <Button
          className="mt-4"
          onClick={() =>
            onStart(date, time, new Date(Date.now() + hours * 3600_000).toISOString())
          }
        >
          Start dinner planning
        </Button>
      </Card>
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
              {yesCount} coming · {maybeCount} maybe · {noCount} can&apos;t · auto-books by{' '}
              {expiresLabel}
            </p>
          </div>
          <Badge color={d.phase === 'booked' ? 'green' : 'amber'}>{d.phase}</Badge>
        </div>
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
            Can you make it?
          </h3>
          <p className="mb-3 text-sm text-slate-500">
            RSVP so we know the headcount. We&apos;ll pick the spot about a week out and send you
            the details.
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
                Close RSVPs &amp; pick a spot →
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* GENRE VOTE */}
      {d.phase === 'genre' && (
        <Card>
          <h3 className="mb-3 font-display text-base font-bold text-slate-900">Vote: what are we feeling?</h3>
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
              Tally &amp; pick restaurants →
            </Button>
          )}
        </Card>
      )}

      {/* RESTAURANT VOTE */}
      {d.phase === 'restaurant' && (
        <Card>
          <h3 className="mb-1 font-display text-base font-bold text-slate-900">
            Vote: {d.winningGenre} restaurants in {e.city}
          </h3>
          <p className="mb-4 text-xs text-slate-400">Top-voted is auto-booked at the deadline.</p>
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
