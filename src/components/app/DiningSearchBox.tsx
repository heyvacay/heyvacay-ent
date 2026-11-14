'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from './ui';
import { Check, MapPin } from '@/components/icons';
import { placesHotels, type HotelPlace } from '@/lib/search';
import { searchRestaurants, type Restaurant } from '@/lib/restaurants';

/**
 * One smart search box for dining. First you pick a city (region typeahead);
 * once a city is set it turns into a restaurant typeahead for THAT city — so
 * typing a specific place shows a dropdown of matching restaurants (in and near
 * the city), not a second box. Picking a restaurant jumps straight to it;
 * otherwise you search everything in the city.
 */
export function DiningSearchBox({
  city,
  lat,
  lng,
  genre,
  onCity,
  onClearCity,
  onSearchAll,
  onPickRestaurant,
}: {
  city: string;
  lat?: number;
  lng?: number;
  genre?: string;
  /** A city/region was chosen (carries coordinates for "near" search). */
  onCity: (label: string, lat?: number, lng?: number) => void;
  onClearCity: () => void;
  /** Search everything in the current city (Enter or "see all"). */
  onSearchAll: () => void;
  /** A specific restaurant was chosen from the dropdown. */
  onPickRestaurant: (r: Restaurant) => void;
}) {
  const hasCity = city.trim().length > 0;
  const cityName = city.split(',')[0].trim();

  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<HotelPlace[]>([]);
  const [rests, setRests] = useState<Restaurant[]>([]);
  const [loadingR, setLoadingR] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // City suggestions (only before a city is committed).
  useEffect(() => {
    if (hasCity) return;
    const term = text.trim();
    if (term.length < 2) {
      setCities([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const places = await placesHotels(term);
        if (live) setCities(places.filter((p) => p.type === 'region').slice(0, 6));
      } catch {
        if (live) setCities([]);
      }
    }, 240);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text, hasCity]);

  // Restaurant suggestions (once a city is committed).
  useEffect(() => {
    if (!hasCity) return;
    const term = text.trim();
    if (term.length < 2) {
      setRests([]);
      return;
    }
    let live = true;
    setLoadingR(true);
    const t = setTimeout(async () => {
      try {
        const rs = await searchRestaurants(cityName, genre || undefined, term, { lat, lng });
        if (live) setRests(rs.slice(0, 7));
      } catch {
        if (live) setRests([]);
      } finally {
        if (live) setLoadingR(false);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text, hasCity, cityName, genre, lat, lng]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const commitCity = (p: HotelPlace) => {
    onCity([p.label, p.sub].filter(Boolean).join(', '), p.lat, p.lng);
    setText('');
    setCities([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      {/* City pill (once chosen) */}
      {hasCity && (
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand-dark">
          <MapPin className="h-3.5 w-3.5" /> {city}
          <button
            type="button"
            onClick={() => {
              onClearCity();
              setText('');
              setRests([]);
            }}
            className="text-brand-dark/60 hover:text-rose-500"
            aria-label="Change city"
          >
            ×
          </button>
        </div>
      )}

      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hasCity) {
            e.preventDefault();
            setOpen(false);
            onSearchAll();
          }
        }}
        placeholder={hasCity ? `Search a restaurant in ${cityName}, or press Enter for all` : 'Search a city…'}
        autoComplete="off"
      />

      {open && !hasCity && cities.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {cities.map((p, i) => (
            <li key={`${p.regionId}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitCity(p);
                }}
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

      {open && hasCity && text.trim().length >= 2 && (
        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {rests.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  onPickRestaurant(r);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-xs font-bold text-brand-dark">
                    {r.name[0]}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{r.name}</span>
                  <span className="block truncate text-xs text-slate-400">
                    {r.cuisine} · {r.neighborhood || r.city}
                    {typeof r.distanceMi === 'number' && r.distanceMi > 1 ? ` · ${Math.round(r.distanceMi)} mi` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-amber-500">★ {r.rating}</span>
              </button>
            </li>
          ))}
          <li className="border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                onSearchAll();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-brand-dark hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Check className="h-3.5 w-3.5" /> See all restaurants in {cityName}
            </button>
          </li>
          {loadingR && rests.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">Searching {cityName}…</li>
          )}
        </ul>
      )}
    </div>
  );
}
