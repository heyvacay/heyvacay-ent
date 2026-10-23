'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  startHotels,
  nextHotels,
  nightsBetween,
  type HotelSearchArgs,
} from '@/lib/search';
import type { InventoryOption } from '@/lib/types';
import { rewardsFor } from '@/lib/rewards';
import { HotelCarousel } from '@/components/hotels/HotelCarousel';
import { Button, Card, Select, EmptyState } from '@/components/app/ui';
import { HvLoader } from '@/components/HvLoader';
import { money, num } from '@/lib/format';
import { Check, Shield, Gift, MapPin } from '@/components/icons';

const SORTS: { value: string; label: string; sortBy: string; sortOrder: string }[] = [
  { value: 'recommended', label: 'Recommended', sortBy: 'recommended', sortOrder: 'asc' },
  { value: 'price_asc', label: 'Price: low to high', sortBy: 'price', sortOrder: 'asc' },
  { value: 'price_desc', label: 'Price: high to low', sortBy: 'price', sortOrder: 'desc' },
  { value: 'rating', label: 'Guest rating', sortBy: 'customer_rating', sortOrder: 'desc' },
  { value: 'stars', label: 'Star rating', sortBy: 'star_rating', sortOrder: 'desc' },
];

function Stars({ n = 0 }: { n?: number }) {
  return (
    <span className="text-sm leading-none">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? 'text-amber-400' : 'text-slate-200'}>
          ★
        </span>
      ))}
    </span>
  );
}

function Signals({
  savings,
  points,
  needsApproval,
  inPolicy,
}: {
  savings: number;
  points: number;
  needsApproval: boolean;
  inPolicy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {inPolicy ? (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" /> In policy
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Shield className="h-3.5 w-3.5" /> {needsApproval ? 'Needs approval' : 'Policy note'}
        </span>
      )}
      {savings > 0 && (
        <span className="font-semibold text-emerald-600">Saves company {money(savings)}</span>
      )}
      <span className="inline-flex items-center gap-1 font-semibold text-brand-dark">
        <Gift className="h-3.5 w-3.5" /> +{num(points)} pts
      </span>
    </div>
  );
}

export default function HotelsResults() {
  const params = useSearchParams();
  const { evaluatePolicies } = useStore();

  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  const adults = Number(params.get('adults')) || 1;
  const label = params.get('label') || 'your destination';
  const regionId = params.get('regionId');
  const lat = params.get('lat');
  const lng = params.get('lng');
  const hid = params.get('hid');
  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 1;

  const [options, setOptions] = useState<InventoryOption[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState('recommended');

  const baseArgs = useCallback((): HotelSearchArgs => {
    const chosen = SORTS.find((s) => s.value === sort) ?? SORTS[0];
    return {
      checkin,
      checkout,
      adults,
      pageSize: 20,
      sortBy: chosen.sortBy,
      sortOrder: chosen.sortOrder,
      ...(regionId
        ? { regionId: Number(regionId) }
        : lat && lng
          ? { lat: Number(lat), lng: Number(lng) }
          : {}),
      ...(hid ? { hid: Number(hid) } : {}),
    };
  }, [checkin, checkout, adults, sort, regionId, lat, lng, hid]);

  // Initial load (and on sort change) + background backfill of the first ~65.
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setOptions([]);
    setSessionId(null);
    setHasMore(false);

    (async () => {
      try {
        const page = await startHotels(baseArgs());
        if (!live) return;
        setOptions(page.options);
        setSessionId(page.sessionId);
        setHasMore(page.hasMore);
        setLoading(false);

        // Background backfill — pull the next 45 so the list fills out fast.
        if (page.sessionId && page.hasMore) {
          const more = await nextHotels(page.sessionId, 45, nights);
          if (!live) return;
          setOptions((prev) => prev.concat(more.options));
          setHasMore(more.hasMore);
        }
      } catch (e) {
        if (!live) return;
        setError(e instanceof Error ? e.message : 'Hotel search failed.');
        setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [baseArgs, nights]);

  // Infinite scroll — load every remaining hotel as the sentinel appears.
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(async () => {
    if (!sessionId || !hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await nextHotels(sessionId, 20, nights);
      setOptions((prev) => prev.concat(more.options));
      setHasMore(more.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [sessionId, hasMore, loading, loadingMore, nights]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      { rootMargin: '400px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const detailHref = (opt: InventoryOption) => {
    const q = new URLSearchParams();
    q.set('checkin', checkin);
    q.set('checkout', checkout);
    q.set('adults', String(adults));
    q.set('label', opt.title);
    q.set('price', String(opt.price));
    q.set('market', String(opt.marketPrice));
    if (opt.star) q.set('star', String(opt.star));
    if (opt.rating != null) q.set('rating', String(opt.rating));
    if (opt.reviews != null) q.set('reviews', String(opt.reviews));
    if (opt.location) q.set('loc', opt.location);
    return `/app/hotels/${opt.hid}?${q.toString()}`;
  };

  return (
    <div>
      {/* header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/app/book"
            className="text-sm font-medium text-brand-dark hover:underline"
          >
            ← Edit search
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
            Hotels in {label}
          </h1>
          <p className="text-sm text-slate-400">
            {checkin} → {checkout} · {nights} night{nights === 1 ? '' : 's'} ·{' '}
            {adults} guest{adults === 1 ? '' : 's'}
            {!loading && ` · ${options.length} stays${hasMore ? '+' : ''}`}
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-700">{error}</p>
        </Card>
      )}

      {loading && <HvLoader className="py-24" />}

      {!loading && options.length === 0 && !error && (
        <EmptyState
          title="No hotels for those dates"
          sub="Try different dates or a nearby destination."
        />
      )}

      {!loading && options.length > 0 && (
        <div className="space-y-4">
          {options.map((opt) => {
            const flags = evaluatePolicies(opt, checkin);
            const { savings, points } = rewardsFor(opt);
            const needsApproval = flags.some(
              (f) => f.policy.action === 'approve' || f.policy.action === 'block'
            );
            const amenities =
              opt.details?.kind === 'hotel' ? opt.details.amenities : [];
            const perNight = Math.round(opt.price / (opt.nights || 1));
            return (
              <Card key={opt.id} pad={false} className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <HotelCarousel
                    images={opt.images ?? []}
                    alt={opt.title}
                    className="h-52 w-full shrink-0 sm:h-auto sm:w-72"
                  />
                  <div className="flex flex-1 flex-col gap-2 p-4 sm:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Stars n={opt.star} />
                        {opt.rating != null && (
                          <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand-dark">
                            {opt.rating.toFixed(1)}
                          </span>
                        )}
                        {opt.reviews != null && opt.reviews > 0 && (
                          <span className="text-xs text-slate-400">
                            {num(opt.reviews)} reviews
                          </span>
                        )}
                      </div>
                      <Link
                        href={detailHref(opt)}
                        className="line-clamp-1 font-display text-lg font-bold text-slate-900 hover:text-brand-dark"
                      >
                        {opt.title}
                      </Link>
                      {opt.location && (
                        <p className="inline-flex items-center gap-1 text-sm text-slate-400">
                          <MapPin className="h-3.5 w-3.5" /> {opt.location}
                        </p>
                      )}
                      {amenities.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1.5">
                          {amenities.slice(0, 4).map((a) => (
                            <span
                              key={a}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                            >
                              {a}
                            </span>
                          ))}
                          {amenities.length > 4 && (
                            <span className="px-1 py-0.5 text-xs text-slate-400">
                              +{amenities.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-1">
                        <Signals
                          savings={savings}
                          points={points}
                          needsApproval={needsApproval}
                          inPolicy={flags.length === 0}
                        />
                      </div>
                      {opt.freeCancellation && (
                        <p className="text-xs font-medium text-emerald-600">
                          Free cancellation
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end justify-between gap-2 border-t border-slate-100 pt-3 sm:w-44 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                      <div className="text-right">
                        {savings > 0 && (
                          <div className="text-sm text-slate-400 line-through">
                            {money(opt.marketPrice)}
                          </div>
                        )}
                        <div className="font-display text-xl font-bold text-slate-900">
                          {money(opt.price)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {money(perNight)}/night · incl. taxes
                        </div>
                      </div>
                      <Button href={detailHref(opt)} size="sm" className="w-full">
                        See rooms
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          <div ref={sentinel} />
          {loadingMore && (
            <div className="grid place-items-center py-6 text-slate-400">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
            </div>
          )}
          {!hasMore && (
            <p className="py-4 text-center text-sm text-slate-400">
              That&apos;s every hotel for your search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
