'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/app/ui';
import { money, dateRange } from '@/lib/format';
import { Plane, Receipt } from '@/components/icons';
import type { BookingStatus } from '@/lib/types';

const FILTERS: { key: 'all' | BookingStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function BookingsPage() {
  const {
    state,
    userById,
    approveBooking,
    cancelBooking,
    companySpend,
    companySavings,
  } = useStore();
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');

  const rows = [...state.bookings]
    .filter((b) => (filter === 'all' ? true : b.status === filter))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle="Every trip across the company, with what you saved on each."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total trips" value={state.bookings.length} />
        <StatCard label="Spend" value={money(companySpend)} />
        <StatCard accent label="Saved vs market" value={money(companySavings)} />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No bookings here" sub="Try a different filter." />
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <Card key={b.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                {b.type === 'flight' ? (
                  <Plane className="h-5 w-5" />
                ) : (
                  <Receipt className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{b.title}</p>
                  {b.status === 'confirmed' && <Badge color="green">Confirmed</Badge>}
                  {b.status === 'pending_approval' && (
                    <Badge color="amber">Pending approval</Badge>
                  )}
                  {b.status === 'cancelled' && <Badge color="slate">Cancelled</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-slate-400">{b.detail}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {userById(b.travelerId)?.name} · {b.department} ·{' '}
                  {dateRange(b.startDate, b.endDate)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-slate-900">
                    {money(b.price)}
                  </p>
                  {b.savings > 0 && (
                    <p className="text-xs font-semibold text-emerald-600">
                      saved {money(b.savings)}
                    </p>
                  )}
                </div>
                {b.status === 'pending_approval' && (
                  <Button size="sm" onClick={() => approveBooking(b.id)}>
                    Approve
                  </Button>
                )}
                {b.status !== 'cancelled' && b.status !== 'pending_approval' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelBooking(b.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
