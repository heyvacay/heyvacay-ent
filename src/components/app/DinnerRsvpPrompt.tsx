'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useEvents } from '@/lib/eventsStore';
import { dinnerExpired, eventDinners, type Dinner, type RsvpStatus } from '@/lib/events';
import { shortDate } from '@/lib/format';
import { Calendar, Check, MapPin } from '@/components/icons';

/**
 * Home-screen group-dinner RSVP. Pops up wherever the traveler lands whenever a
 * dinner is collecting RSVPs and they haven't answered yet, so they don't have
 * to dig into the event. Answering here writes straight to the event. The host
 * keeps following up by email (dinnerReminder) from the event page; this prompt
 * stays until the person responds.
 */
export function DinnerRsvpPrompt() {
  const { activeUser } = useStore();
  const { events, setRsvp } = useEvents();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  // The first event+night dinner that needs this user's input — either an RSVP,
  // or (once they're in) a vote on the food genre / restaurant. Each night of a
  // multi-day event is checked independently, so a 3-night trip can surface a
  // separate prompt per night.
  const nowISO = new Date().toISOString();
  const needsInput = (e: (typeof events)[number], d: Dinner): boolean => {
    if (dinnerExpired(d, nowISO)) return false;
    if (!e.attendees.some((a) => a.userId === activeUser.id)) return false;
    if (d.phase === 'rsvp' || d.phase === 'join') return d.rsvps[activeUser.id] == null;
    const inParty = d.attendees.some((a) => a.userId === activeUser.id);
    if (!inParty) return false;
    if (d.phase === 'genre') return d.genreVotes[activeUser.id] == null;
    if (d.phase === 'restaurant') return d.restaurantVotes[activeUser.id] == null;
    return false;
  };

  let pendingEvent: (typeof events)[number] | undefined;
  let d: Dinner | undefined;
  for (const e of events) {
    for (const dn of eventDinners(e)) {
      if (dismissed[`${e.id}:${dn.id}`]) continue;
      if (needsInput(e, dn)) {
        pendingEvent = e;
        d = dn;
        break;
      }
    }
    if (d) break;
  }

  if (!pendingEvent || !d) return null;
  const dinner = d;
  const promptKey = `${pendingEvent.id}:${dinner.id}`;
  const needsRsvp = dinner.phase === 'rsvp' || dinner.phase === 'join';

  const answer = (status: RsvpStatus) => {
    setRsvp(pendingEvent!.id, dinner.id, activeUser.id, activeUser.name, status);
  };

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-brand/40 bg-brand/5 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-dark">
            <Calendar className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              {needsRsvp
                ? `You're invited to the group dinner for ${pendingEvent.name}`
                : dinner.phase === 'genre'
                  ? `Vote on the food genre for ${pendingEvent.name}'s dinner`
                  : `Vote on the restaurant for ${pendingEvent.name}'s dinner`}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {shortDate(dinner.date)} · {dinner.time}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {pendingEvent.city}
              </span>
            </p>
            <Link
              href={`/app/events/${pendingEvent.id}`}
              className="mt-1 inline-block text-xs font-semibold text-brand-dark hover:underline"
            >
              See details →
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {needsRsvp ? (
            <>
              <button
                onClick={() => answer('yes')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-navy-deep hover:brightness-95"
              >
                <Check className="h-4 w-4" /> I&apos;m in
              </button>
              <button
                onClick={() => answer('maybe')}
                className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Maybe
              </button>
              <button
                onClick={() => answer('no')}
                className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Can&apos;t make it
              </button>
            </>
          ) : (
            <Link
              href={`/app/events/${pendingEvent.id}?tab=dinner`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-navy-deep hover:brightness-95"
            >
              Vote now →
            </Link>
          )}
          <button
            onClick={() => setDismissed((s) => ({ ...s, [promptKey]: true }))}
            aria-label="Dismiss"
            className="rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
