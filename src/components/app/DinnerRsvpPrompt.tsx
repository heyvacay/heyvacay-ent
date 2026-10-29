'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useEvents } from '@/lib/eventsStore';
import { dinnerExpired, type RsvpStatus } from '@/lib/events';
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

  // The first event with a dinner still collecting RSVPs that the user is
  // invited to and hasn't answered yet.
  const nowISO = new Date().toISOString();
  const pendingEvent = events.find((e) => {
    const d = e.dinner;
    if (!d || d.phase !== 'rsvp' || dinnerExpired(d, nowISO)) return false;
    const invited = e.attendees.some((a) => a.userId === activeUser.id);
    const answered = d.rsvps[activeUser.id] != null;
    return invited && !answered && !dismissed[e.id];
  });

  if (!pendingEvent || !pendingEvent.dinner) return null;
  const d = pendingEvent.dinner;

  const answer = (status: RsvpStatus) => {
    setRsvp(pendingEvent.id, activeUser.id, activeUser.name, status);
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
              You&apos;re invited to the group dinner for {pendingEvent.name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {shortDate(d.date)} · {d.time}
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
          <button
            onClick={() => setDismissed((s) => ({ ...s, [pendingEvent.id]: true }))}
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
