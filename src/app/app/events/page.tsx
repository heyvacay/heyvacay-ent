'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useEvents } from '@/lib/eventsStore';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader } from '@/components/app/ui';
import { shortDate, todayISO } from '@/lib/format';
import { Calendar, MapPin, Users, Sparkles } from '@/components/icons';

export default function EventsPage() {
  const { state, activeUser, role } = useStore();
  const { events, createEvent } = useEvents();
  const router = useRouter();
  // Events can edit policy (allow-lists), so only admins / bookers create them.
  // Everyone else can still be added to and join events.
  const canCreate = role === 'admin' || role === 'booker';

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    city: '',
    startDate: todayISO(),
    endDate: todayISO(),
    allowHotels: '',
    allowFlights: '',
  });

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

  const create = (prefill?: { startDate: string; endDate: string }) => {
    const f = prefill ? { ...form, ...prefill } : form;
    if (!f.name.trim() || !f.city.trim()) {
      setOpen(true);
      return;
    }
    const ev = createEvent({
      name: f.name.trim(),
      city: f.city.trim(),
      startDate: f.startDate,
      endDate: f.endDate,
      hostId: activeUser.id,
      hostName: activeUser.name,
      allowHotels: f.allowHotels.split(',').map((s) => s.trim()).filter(Boolean),
      allowFlights: f.allowFlights.split(',').map((s) => s.trim()).filter(Boolean),
      attendees: state.users
        .filter((u) => u.status === 'active')
        .map((u) => ({ userId: u.id, name: u.name })),
    });
    setOpen(false);
    router.push(`/app/events/${ev.id}`);
  };

  const mine = events.filter((e) => e.attendees.some((a) => a.userId === activeUser.id)) ;
  const shown = role === 'admin' ? events : mine;

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Company trips with an allow-list of travel, a group chat, and group dinners."
        actions={
          canCreate ? (
            <Button onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'New event'}</Button>
          ) : undefined
        }
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
              <Button
                size="sm"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    name: f.name || 'Team trip',
                    startDate: s.start,
                    endDate: s.end,
                  }));
                  setOpen(true);
                }}
              >
                Create event
              </Button>
            </div>
          ))}
        </Card>
      )}

      {open && (
        <Card className="mb-6">
          <h2 className="mb-4 font-display text-lg font-bold text-slate-900">New event</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Austin Q4 Offsite" autoFocus />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Austin" />
            </Field>
            <Field label="Start date">
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="End date">
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
            <Field label="Allowed hotels (comma-separated)" hint="Bookings outside this need admin approval. Blank = no limit.">
              <Input value={form.allowHotels} onChange={(e) => setForm({ ...form, allowHotels: e.target.value })} placeholder="Austin Proper, Fairmont Austin" />
            </Field>
            <Field label="Allowed flight routes" hint="e.g. SFO→AUS. Blank = no limit.">
              <Input value={form.allowFlights} onChange={(e) => setForm({ ...form, allowFlights: e.target.value })} placeholder="SFO→AUS, JFK→AUS" />
            </Field>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => create()} disabled={!form.name.trim() || !form.city.trim()}>
              Create event
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {shown.length === 0 ? (
        <EmptyState title="No events yet" sub="Create one to coordinate a company trip." />
      ) : (
        <div className="space-y-2">
          {shown.map((e) => (
            <Link
              key={e.id}
              href={`/app/events/${e.id}`}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 sm:flex-row sm:items-center"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
                <Calendar className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">{e.name}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.city}</span>
                  <span>{shortDate(e.startDate)}–{shortDate(e.endDate)}</span>
                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {e.attendees.length}</span>
                </p>
              </div>
              {e.dinner && (
                <Badge color={e.dinner.phase === 'booked' ? 'green' : 'amber'}>
                  {e.dinner.phase === 'booked' ? 'Dinner booked' : 'Dinner planning'}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
