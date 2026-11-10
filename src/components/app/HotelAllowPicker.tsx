'use client';

import { useEffect, useRef, useState } from 'react';
import {
  placesHotels,
  startHotels,
  nightsBetween,
  type HotelPlace,
} from '@/lib/search';
import type { InventoryOption } from '@/lib/types';
import { MapPin, Check, Sparkles } from '@/components/icons';
import { money } from '@/lib/format';

export interface AllowHotel {
  hid: string;
  name: string;
}

export interface HotelSearchCtx {
  city?: string;
  regionId?: number;
  lat?: number;
  lng?: number;
  checkin?: string;
  checkout?: string;
}

/**
 * Smart hotel allow-list input. Two ways to add a property:
 *  1. Type a hotel name (supplier index typeahead), or
 *  2. Browse the live hotels available in the event city for the event dates —
 *     real cards with photo, star and nightly price — and click to pin them.
 * Browsing is the reliable way to find small/independent hotels the name index
 * doesn't surface, and shows exactly what travelers will see.
 */
export function HotelAllowPicker({
  value,
  onChange,
  searchCtx,
}: {
  value: AllowHotel[];
  onChange: (list: AllowHotel[]) => void;
  searchCtx?: HotelSearchCtx;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HotelPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Browse panel state.
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [browseErr, setBrowseErr] = useState<string | null>(null);
  const [results, setResults] = useState<InventoryOption[]>([]);

  const canBrowse =
    !!searchCtx?.checkin &&
    !!searchCtx?.checkout &&
    (searchCtx.regionId != null ||
      (searchCtx.lat != null && searchCtx.lng != null));
  const nights =
    searchCtx?.checkin && searchCtx?.checkout
      ? nightsBetween(searchCtx.checkin, searchCtx.checkout)
      : 1;

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

  const runBrowse = async () => {
    if (!canBrowse || !searchCtx) return;
    setBrowseOpen(true);
    setBrowsing(true);
    setBrowseErr(null);
    try {
      const page = await startHotels({
        regionId: searchCtx.regionId,
        lat: searchCtx.lat,
        lng: searchCtx.lng,
        checkin: searchCtx.checkin!,
        checkout: searchCtx.checkout!,
        adults: 1,
        pageSize: 18,
      });
      setResults(page.options);
      if (page.options.length === 0)
        setBrowseErr('No hotels came back for these dates — try different dates.');
    } catch {
      setBrowseErr('Could not load hotels right now.');
    } finally {
      setBrowsing(false);
    }
  };

  const addPlace = (p: HotelPlace) => {
    const hid = String(p.hid);
    if (value.some((h) => h.hid === hid)) return;
    onChange([...value, { hid, name: p.label }]);
    setQ('');
    setItems([]);
    setOpen(false);
  };

  const addResult = (o: InventoryOption) => {
    const hid = String(o.hid ?? o.id);
    if (value.some((h) => h.hid === hid)) return;
    onChange([...value, { hid, name: o.title }]);
  };

  const remove = (hid: string) => onChange(value.filter((h) => h.hid !== hid));
  const has = (hid: string) => value.some((h) => h.hid === hid);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div ref={boxRef} className="relative flex-1">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search a hotel by name…"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
          )}
          {open && items.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {items.map((p) => (
                <li key={String(p.hid)}>
                  <button
                    type="button"
                    onClick={() => addPlace(p)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{p.label}</span>
                      {p.sub && <span className="block truncate text-xs text-slate-400">{p.sub}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {canBrowse && (
          <button
            type="button"
            onClick={() => (browseOpen ? setBrowseOpen(false) : runBrowse())}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand/10 px-3.5 py-2 text-sm font-semibold text-brand-dark hover:bg-brand/20"
          >
            <Sparkles className="h-4 w-4" />
            {browseOpen ? 'Hide hotels' : `Browse hotels in ${searchCtx?.city || 'the city'}`}
          </button>
        )}
      </div>

      {!canBrowse && (
        <p className="mt-1.5 text-xs text-slate-400">
          Pick the city and dates first to browse live hotels with prices.
        </p>
      )}

      {/* Browse results */}
      {browseOpen && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-white/5">
          {browsing ? (
            <div className="flex items-center gap-2 px-1 py-6 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
              Finding hotels in {searchCtx?.city || 'the city'}…
            </div>
          ) : browseErr ? (
            <p className="px-1 py-4 text-sm text-slate-500">{browseErr}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((o) => {
                const hid = String(o.hid ?? o.id);
                const nightly = Math.round(o.price / Math.max(1, nights));
                const added = has(hid);
                return (
                  <div
                    key={o.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="relative h-28 w-full bg-slate-100 dark:bg-slate-800">
                      {o.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.imageUrl} alt={o.title} className="h-full w-full object-cover" />
                      )}
                      {o.star != null && (
                        <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {o.star}★
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white" title={o.title}>
                        {o.title}
                      </p>
                      {o.location && (
                        <p className="mt-0.5 truncate text-xs text-slate-400">{o.location}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {money(nightly)}
                          <span className="text-xs font-normal text-slate-400">/night</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => (added ? remove(hid) : addResult(o))}
                          className={
                            added
                              ? 'inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200'
                              : 'rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-navy-deep hover:brightness-95'
                          }
                        >
                          {added ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Added
                            </>
                          ) : (
                            'Add'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected chips */}
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
