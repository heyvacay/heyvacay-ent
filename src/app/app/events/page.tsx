'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useEvents } from '@/lib/eventsStore';
import { Button, Card, EmptyState, PageHeader } from '@/components/app/ui';
import { shortDate } from '@/lib/format';
import { Calendar, MapPin, Sparkles } from '@/components/icons';

export default function EventsPage() {
  const { state, activeUser, role } = useStore();
  const { events } = useEvents();
  // Events edit policy (allow-lists), so only admins / bookers create them.
  const canCreate = role === 'admin' || role === 'booker';

  // Auto-detection: confirmed hotel bookings that share a check-in date are
  // likely the same company trip — suggest spinning up an event + group chat.
  const suggestions = useMemo(() => {
    const byStart: Record<string, { travelers: Set<string>; end: string }> = {};
    for (const b of state.bookings) {
      if (b.type !== 'hotel' || b.status === 'cancelled') continue;
      const k = b.startDate;
      byStart[k] = byStart[k] || { travelers: new Set(), end: b.endDate };
      byStart[k].travelers.add(b.travelerId);
    }
    const existing = new Set(events.map((e) => `${e.startDate}`));
    return Object.entries(byStart)
      .filter(([start, v]) => v.travelers.size >= 2 && !existing.has(start))
      .map(([start, v]) => ({ start, end: v.end, count: v.travelers.size }));
  }, [state.bookings, events]);

  const mine = events.filter((e) => e.attendees.some((a) => a.userId === activeUser.id));
  const shown = role === 'admin' ? events : mine;

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Company trips with an allow-list of travel, a group chat, and group dinners."
        actions={canCreate ? <Button href="/app/events/new">New event</Button> : undefined}
      />

      {canCreate && suggestions.length > 0 && (
        <Card className="mb-5 border-brand/30 bg-brand/5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-brand-dark" /> Nova spotted a group trip
          </p>
          {suggestions.map((s) => (
            <div key={s.start} className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                {s.count} teammates travelling {shortDate(s.start)}–{shortDate(s.end)}. Create an event
                so they can coordinate and get dinner together?
              </p>
              <Button size="sm" href={`/app/events/new?start=${s.start}&end=${s.end}`}>
                Create event
              </Button>
            </div>
          ))}
        </Card>
      )}

      {shown.length === 0 ? (
        <EmptyState title="No events yet" sub="Create one to coordinate a company trip." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((e) => (
            <Link
              key={e.id}
              href={`/app/events/${e.id}`}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
            >
              <div className="relative h-20 overflow-hidden bg-gradient-to-br from-navy via-surface to-brand-dark">
                <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-brand/30 blur-2xl" />
                <span className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
                  <Calendar className="h-5 w-5" />
                </span>
                {e.dinner && (
                  <span
                    className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      e.dinner.phase === 'booked'
                        ? 'bg-emerald-400/20 text-emerald-100'
                        : 'bg-amber-400/20 text-amber-100'
                    }`}
                  >
                    {e.dinner.phase === 'booked' ? 'Dinner booked' : 'Dinner planning'}
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="font-display font-bold text-slate-900 group-hover:text-brand-dark">
                  {e.name}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {e.city}
                  </span>
                  <span>
                    {shortDate(e.startDate)}–{shortDate(e.endDate)}
                  </span>
                </p>
                <div className="mt-3 flex items-center -space-x-1.5">
                  {e.attendees.slice(0, 6).map((a) => (
                    <span
                      key={a.userId}
                      title={a.name}
                      className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white ring-2 ring-white"
                    >
                      {a.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                    </span>
                  ))}
                  {e.attendees.length > 6 && (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 ring-2 ring-white">
                      +{e.attendees.length - 6}
                    </span>
                  )}
                  <span className="pl-3 text-xs text-slate-400">{e.attendees.length} attending</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
