'use client';

import { useEffect, useRef, useState } from 'react';
import { placesHotels, type HotelPlace } from '@/lib/search';
import { MapPin, Check } from '@/components/icons';

export interface AllowHotel {
  hid: string;
  name: string;
}

/**
 * Smart hotel allow-list input. Types against the real supplier index and adds
 * the chosen properties (with their ids) as removable chips — so an event can
 * pin exactly the hotels it allows, regardless of policy.
 */
export function HotelAllowPicker({
  value,
  onChange,
}: {
  value: AllowHotel[];
  onChange: (list: AllowHotel[]) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HotelPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const places = await placesHotels(term);
        if (live) setItems(places.filter((p) => p.type === 'hotel' && p.hid != null).slice(0, 6));
      } finally {
        if (live) setLoading(false);
      }
    }, 240);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const add = (p: HotelPlace) => {
    const hid = String(p.hid);
    if (value.some((h) => h.hid === hid)) return;
    onChange([...value, { hid, name: p.label }]);
    setQ('');
    setItems([]);
    setOpen(false);
  };

  const remove = (hid: string) => onChange(value.filter((h) => h.hid !== hid));

  return (
    <div>
      <div ref={boxRef} className="relative">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search a hotel to allow…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
        )}
        {open && items.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((p) => (
              <li key={String(p.hid)}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{p.label}</span>
                    {p.sub && <span className="block truncate text-xs text-slate-400">{p.sub}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((h) => (
            <span
              key={h.hid}
              className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-dark"
            >
              <Check className="h-3 w-3" /> {h.name}
              <button
                type="button"
                onClick={() => remove(h.hid)}
                className="ml-0.5 text-brand-dark/60 hover:text-brand-dark"
                aria-label={`Remove ${h.name}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
