'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { useEvents } from '@/lib/eventsStore';
import { Button, Card, EmptyState, Field, Input, PageHeader } from '@/components/app/ui';
import { HotelAllowPicker, type AllowHotel } from '@/components/app/HotelAllowPicker';
import { shortDate, todayISO } from '@/lib/format';
import { Calendar, MapPin, Sparkles } from '@/components/icons';

export default function EventsPage() {
  const { state, activeUser, role } = useStore();
  const { events, createEvent } = useEvents();
  const router = useRouter();
  // Events can edit policy (allow-lists), so only admins / bookers create them.
  // Everyone else can still be added to and join events.
  const canCreate = role === 'admin' || role === 'booker';

  const [open, setOpen] = useState(false);
  const [allowHotelList, setAllowHotelList] = useState<AllowHotel[]>([]);
  const [form, setForm] = useState({
    name: '',
    city: '',
    startDate: todayISO(),
    endDate: todayISO(),
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
      allowHotels: allowHotelList.map((h) => h.name),
      allowHotelList,
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
            <div className="sm:col-span-2">
              <Field
                label="Allowed hotels"
                hint="Search and add real properties. In event-only booking these are the only hotels shown — and they book without approval, even if out of policy."
              >
                <HotelAllowPicker value={allowHotelList} onChange={setAllowHotelList} />
              </Field>
            </div>
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
