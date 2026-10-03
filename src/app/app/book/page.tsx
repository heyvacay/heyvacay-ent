'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
} from '@/components/app/ui';
import { money, num, todayISO, addDays } from '@/lib/format';
import { inventoryFor } from '@/lib/seed';
import { Plane, Receipt, Check, Shield, Gift } from '@/components/icons';
import type { BookingType, InventoryOption } from '@/lib/types';

export default function BookPage() {
  const { state, role, activeUser, evaluatePolicies, book } = useStore();
  const canBookForOthers = role === 'admin' || role === 'booker';

  const [type, setType] = useState<BookingType>('flight');
  const [destination, setDestination] = useState('New York');
  const [start, setStart] = useState(addDays(todayISO(), 14));
  const [end, setEnd] = useState(addDays(todayISO(), 17));
  const [travelerId, setTravelerId] = useState(activeUser.id);
  const [results, setResults] = useState<InventoryOption[] | null>(null);
  const [confirmed, setConfirmed] = useState<{
    opt: InventoryOption;
    pending: boolean;
    points: number;
  } | null>(null);

  const search = () => {
    setConfirmed(null);
    setResults(inventoryFor(type, destination));
  };

  const confirm = (opt: InventoryOption) => {
    const flags = evaluatePolicies(opt, start);
    const pending = flags.some(
      (f) => f.policy.action === 'approve' || f.policy.action === 'block'
    );
    const savings = Math.max(0, opt.marketPrice - opt.price);
    const points = Math.round(savings * (opt.type === 'flight' ? 2 : 1));
    book({ opt, travelerId, startDate: start, endDate: end });
    setConfirmed({ opt, pending, points });
    setResults(null);
  };

  if (confirmed) {
    const savings = Math.max(
      0,
      confirmed.opt.marketPrice - confirmed.opt.price
    );
    return (
      <div>
        <PageHeader title="Booking" subtitle="You just booked smart." />
        <Card className="mx-auto max-w-xl text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">
            {confirmed.pending ? 'Sent for approval' : 'Trip confirmed'}
          </h2>
          <p className="mt-1 text-slate-500">
            {confirmed.opt.title} · {confirmed.opt.detail}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">Price</p>
              <p className="font-display text-lg font-bold text-slate-900">
                {money(confirmed.opt.price)}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs text-emerald-600">Saved</p>
              <p className="font-display text-lg font-bold text-emerald-700">
                {money(savings)}
              </p>
            </div>
            <div className="rounded-xl bg-brand/10 p-4">
              <p className="text-xs text-brand-dark">Points</p>
              <p className="font-display text-lg font-bold text-brand-dark">
                {confirmed.pending ? '—' : `+${num(confirmed.points)}`}
              </p>
            </div>
          </div>

          {confirmed.pending && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              This trip needs manager approval under your travel policy. Points
              land once it&apos;s approved.
            </p>
          )}

          <div className="mt-6 flex justify-center gap-2">
            <Button href="/app/trips">View my trips</Button>
            <Button variant="outline" onClick={() => setConfirmed(null)}>
              Book another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Book travel"
        subtitle="Same inventory as HeyVacay — always below market, and you earn the savings."
      />

      <Card>
        <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
          {(['flight', 'hotel'] as BookingType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                type === t
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {t === 'flight' ? (
                <Plane className="h-4 w-4" />
              ) : (
                <Receipt className="h-4 w-4" />
              )}
              {t}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Destination">
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="New York"
            />
          </Field>
          <Field label={type === 'flight' ? 'Depart' : 'Check in'}>
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label={type === 'flight' ? 'Return' : 'Check out'}>
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
          {canBookForOthers ? (
            <Field label="Traveler">
              <Select
                value={travelerId}
                onChange={(e) => setTravelerId(e.target.value)}
              >
                {state.users
                  .filter((u) => u.status === 'active')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Field label="Traveler">
              <Input value={activeUser.name} disabled />
            </Field>
          )}
        </div>

        <Button className="mt-5" onClick={search}>
          Search {type}s
        </Button>
      </Card>

      {results && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-400">
            {results.length} options to {destination} — sorted by best value.
          </p>
          {results.map((opt) => {
            const savings = Math.max(0, opt.marketPrice - opt.price);
            const points = Math.round(savings * (opt.type === 'flight' ? 2 : 1));
            const flags = evaluatePolicies(opt, start);
            return (
              <Card
                key={opt.id}
                className="flex flex-col gap-4 sm:flex-row sm:items-center"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                  {opt.type === 'flight' ? (
                    <Plane className="h-5 w-5" />
                  ) : (
                    <Receipt className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{opt.title}</p>
                  <p className="text-sm text-slate-400">{opt.detail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark">
                      <Gift className="h-3.5 w-3.5" />+{num(points)} pts
                    </span>
                    {flags.map((f) => (
                      <span
                        key={f.policy.id}
                        className="inline-flex items-center gap-1 text-xs text-amber-600"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        {f.policy.action === 'approve' ||
                        f.policy.action === 'block'
                          ? 'Needs approval'
                          : 'Policy note'}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-xs text-slate-400 line-through">
                      {money(opt.marketPrice)}
                    </p>
                    <p className="font-display text-xl font-bold text-slate-900">
                      {money(opt.price)}
                    </p>
                    <p className="text-xs font-semibold text-emerald-600">
                      save {money(savings)}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => confirm(opt)}>
                    Book
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
