'use client';

import { useMemo, useState } from 'react';
import { Button, Card, cn } from '@/components/app/ui';
import { toTitleCase, type UiRoom } from '@/lib/hotelRooms';
import { RoomCard, type PolicyStatus, type ReserveArgs } from './RoomCard';

const MAX_ROOMS_TO_DISPLAY = 8;

/** Room-type keywords used to build the quick filter pills (consumer parity). */
const CATEGORIES = [
  'Suite',
  'Deluxe',
  'Studio',
  'Family',
  'Standard',
  'Double',
  'Twin',
  'King',
  'Queen',
  'Villa',
  'Apartment',
];

function roomCategory(room: UiRoom): string | null {
  const t = room.roomTitle.toLowerCase();
  return CATEGORIES.find((c) => t.includes(c.toLowerCase())) ?? null;
}

export function RoomSelection({
  uiRooms,
  onReserve,
  onPhotos,
  assessPolicy,
}: {
  uiRooms: UiRoom[];
  onReserve: (args: ReserveArgs) => void;
  onPhotos: (images: string[], title: string, index: number) => void;
  assessPolicy?: (priceAllIn: number) => { status: PolicyStatus; notes: string[] };
}) {
  const [filter, setFilter] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  // Categories present across the returned rooms — only show the pill row when
  // there's something to filter by.
  const categories = useMemo(() => {
    const present = new Set<string>();
    for (const r of uiRooms) {
      const c = roomCategory(r);
      if (c) present.add(c);
    }
    return CATEGORIES.filter((c) => present.has(c));
  }, [uiRooms]);

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? uiRooms
        : uiRooms.filter((r) => roomCategory(r) === filter),
    [uiRooms, filter]
  );

  const visible = showAll ? filtered : filtered.slice(0, MAX_ROOMS_TO_DISPLAY);
  const hidden = filtered.length - visible.length;

  if (uiRooms.length === 0) return null;

  return (
    <Card id="select-room" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Select room type
        </h2>
        <span className="text-sm text-slate-400">
          {filtered.length} room{filtered.length === 1 ? '' : 's'} available
        </span>
      </div>

      {categories.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Pill active={filter === 'all'} onClick={() => setFilter('all')}>
            All rooms
          </Pill>
          {categories.map((c) => (
            <Pill key={c} active={filter === c} onClick={() => setFilter(c)}>
              {toTitleCase(c)}
            </Pill>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((room) => (
          <RoomCard
            key={room.roomKey}
            room={room}
            onReserve={onReserve}
            onPhotos={onPhotos}
            assessPolicy={assessPolicy}
          />
        ))}
      </div>

      {!showAll && hidden > 0 && (
        <div className="mt-5 text-center">
          <Button variant="outline" onClick={() => setShowAll(true)}>
            Show more rooms ({hidden})
          </Button>
        </div>
      )}
    </Card>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
        active
          ? 'border-brand bg-brand/10 text-brand-dark'
          : 'border-slate-200 text-slate-600 hover:border-slate-300'
      )}
    >
      {children}
    </button>
  );
}
