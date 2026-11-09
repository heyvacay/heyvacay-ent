'use client';

import { useEffect, useState } from 'react';
import { Input } from './ui';
import { Check, MapPin } from '@/components/icons';
import { placesHotels, type HotelPlace } from '@/lib/search';

/**
 * Debounced city typeahead backed by the hotel region suggest endpoint — the
 * same control used to pick an event's city. Emits raw text as the user types
 * (onText) and the chosen region (onPick, carries regionId + lat/lng) on select.
 */
export function CityPicker({
  value,
  selected,
  onText,
  onPick,
  placeholder = 'Search a city…',
  autoFocus,
}: {
  value: string;
  selected?: boolean;
  onText: (v: string) => void;
  onPick: (p: HotelPlace) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [items, setItems] = useState<HotelPlace[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const places = await placesHotels(term);
        if (live) setItems(places.filter((p) => p.type === 'region').slice(0, 6));
      } catch {
        if (live) setItems([]);
      }
    }, 240);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          className={selected ? 'border-emerald-300 bg-emerald-50/40 pr-9' : undefined}
        />
        {selected && (
          <Check className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
        )}
      </div>
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {items.map((p, i) => (
            <li key={`${p.regionId}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(p);
                  setItems([]);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                    {p.label}
                  </span>
                  {p.sub && <span className="block truncate text-xs text-slate-400">{p.sub}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
