'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  getHotelDetail,
  getHotelDescription,
  getHotelReviews,
  nightsBetween,
  type HotelDetailData,
  type HotelReviewSummary,
} from '@/lib/search';
import type { InventoryOption } from '@/lib/types';
import { rewardsFor } from '@/lib/rewards';
import { HotelCarousel } from '@/components/hotels/HotelCarousel';
import { Button, Card, cn } from '@/components/app/ui';
import { money, num } from '@/lib/format';
import { Check, Shield, Gift, MapPin, Building, Sparkles } from '@/components/icons';
import { X } from 'lucide-react';

function Stars({ n = 0 }: { n?: number }) {
  return (
    <span className="text-base leading-none">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? 'text-amber-400' : 'text-slate-200'}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function HotelDetail({ hid }: { hid: string }) {
  const params = useSearchParams();
  const { activeUser, evaluatePolicies, book } = useStore();

  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  const adults = Number(params.get('adults')) || 1;
  const label = params.get('label') || 'Hotel';
  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 1;

  const priceParam = Number(params.get('price')) || 0;
  const marketParam = Number(params.get('market')) || priceParam;
  const starParam = Number(params.get('star')) || undefined;
  const ratingParam = params.get('rating') ? Number(params.get('rating')) : undefined;
  const reviewsParam = params.get('reviews') ? Number(params.get('reviews')) : undefined;
  const locParam = params.get('loc') || undefined;

  const [detail, setDetail] = useState<HotelDetailData | null>(null);
  const [about, setAbout] = useState<string[]>([]);
  const [reviews, setReviews] = useState<HotelReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<{ pending: boolean; points: number } | null>(
    null
  );

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const d = await getHotelDetail({ hid, checkin, checkout, adults });
        if (!live) return;
        setDetail(d);
        setLoading(false);
      } catch (e) {
        if (!live) return;
        setError(e instanceof Error ? e.message : 'Could not load this hotel.');
        setLoading(false);
      }
    })();
    // Description + AI review summary load independently (non-blocking).
    getHotelDescription(hid).then((p) => live && setAbout(p)).catch(() => {});
    getHotelReviews(hid).then((r) => live && setReviews(r)).catch(() => {});
    return () => {
      live = false;
    };
  }, [hid, checkin, checkout, adults]);

  const name = detail?.name || label;
  const star = detail?.star ?? starParam;
  const rating = detail?.rating ?? ratingParam;
  const reviewCount = detail?.reviews ?? reviewsParam;
  const address = detail?.address || locParam;
  const images = detail?.images ?? [];
  const price = priceParam || detail?.rooms.find((r) => r.price)?.price || 0;

  const opt: InventoryOption = {
    id: hid,
    hid,
    type: 'hotel',
    title: name,
    detail: `${nights} night${nights === 1 ? '' : 's'}`,
    price,
    marketPrice: marketParam > price ? marketParam : price,
    star,
    nights,
    location: address,
  };
  const flags = evaluatePolicies(opt, checkin || new Date().toISOString());
  const { savings, points } = rewardsFor(opt);
  const needsApproval = flags.some(
    (f) => f.policy.action === 'approve' || f.policy.action === 'block'
  );
  const perNight = price ? Math.round(price / nights) : 0;

  const reserve = () => {
    book({ opt, travelerId: activeUser.id, startDate: checkin, endDate: checkout });
    setConfirmed({ pending: needsApproval, points });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (confirmed) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-7 w-7" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">
          {confirmed.pending ? 'Sent for approval' : 'Trip confirmed'}
        </h2>
        <p className="mt-1 text-slate-500">
          {name} · {nights} night{nights === 1 ? '' : 's'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button href="/app/trips">View my trips</Button>
          <Button href="/app/book" variant="outline">
            Book another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="pb-28">
      <Link
        href="#"
        onClick={(e) => {
          e.preventDefault();
          history.back();
        }}
        className="text-sm font-medium text-brand-dark hover:underline"
      >
        ← Back to results
      </Link>

      {/* header */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
          {name}
        </h1>
        {star ? <Stars n={star} /> : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
        {rating != null && (
          <span className="inline-flex items-center gap-1">
            <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand-dark">
              {rating.toFixed(1)}
            </span>
            {reviewCount ? `${num(reviewCount)} reviews` : 'Guest rating'}
          </span>
        )}
        {address && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {address}
          </span>
        )}
      </div>

      {error && (
        <Card className="mt-3 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-700">
            {error} You can still reserve this stay below.
          </p>
        </Card>
      )}

      {/* gallery */}
      <div className="mt-4">
        {loading && images.length === 0 ? (
          <div className="h-72 w-full animate-pulse rounded-2xl bg-slate-100" />
        ) : images.length === 0 ? (
          <div className="grid h-72 w-full place-items-center rounded-2xl bg-gradient-to-br from-slate-200 to-brand/25 text-slate-400">
            <Building className="h-10 w-10" />
          </div>
        ) : (
          <div className="relative">
            <div className="grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl" style={{ height: 340 }}>
              <button
                type="button"
                onClick={() => setLightbox(0)}
                className="col-span-2 row-span-2 h-full w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[0]} alt={name} className="h-full w-full object-cover" />
              </button>
              {images.slice(1, 5).map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightbox(i + 1)}
                  className="h-full w-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            {images.length > 1 && (
              <button
                type="button"
                onClick={() => setLightbox(0)}
                className="absolute bottom-3 right-3 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-white"
              >
                See all {images.length} photos
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* amenities */}
          {detail && (detail.amenities.length > 0 || detail.amenityGroups.length > 0) && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
                Amenities
              </h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {(detail.amenities.length
                  ? detail.amenities
                  : detail.amenityGroups.flatMap((g) => g.items)
                )
                  .slice(0, 18)
                  .map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center gap-2 text-sm text-slate-600"
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-dark" /> {a}
                    </span>
                  ))}
              </div>
            </section>
          )}

          {/* about */}
          {about.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
                About this property
              </h2>
              <div className="space-y-2 text-sm leading-relaxed text-slate-600">
                {about.slice(0, 6).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}

          {/* AI review summary */}
          {reviews && (
            <section>
              <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
                <Sparkles className="h-4 w-4 text-brand-dark" /> What guests are saying
              </h2>
              {reviews.rating != null && (
                <p className="mb-2 text-sm text-slate-400">
                  Guest rating {reviews.rating.toFixed(1)}/10
                </p>
              )}
              {reviews.guest_review_summary && (
                <p className="text-sm leading-relaxed text-slate-600">
                  {reviews.guest_review_summary}
                </p>
              )}
              {reviews.best_suited_for && reviews.best_suited_for.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {reviews.best_suited_for.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-dark"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              )}
              {reviews.review_themes && reviews.review_themes.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {reviews.review_themes.slice(0, 6).map((t) => (
                    <div key={t.theme} className="rounded-xl border border-slate-200 p-3">
                      <p className="flex items-center justify-between text-sm font-semibold text-slate-800">
                        {t.theme}
                        {t.sentiment && (
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase',
                              /pos/i.test(t.sentiment)
                                ? 'bg-emerald-50 text-emerald-600'
                                : /neg/i.test(t.sentiment)
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            {t.sentiment}
                          </span>
                        )}
                      </p>
                      {t.summary && (
                        <p className="mt-1 text-xs text-slate-500">{t.summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* rooms */}
          {detail && detail.rooms.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
                Rooms
              </h2>
              <div className="space-y-2">
                {detail.rooms.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{r.name}</p>
                      <p className="text-xs text-slate-400">
                        {[r.meal, r.refundable ? 'Refundable' : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {r.price ? (
                      <div className="shrink-0 text-right">
                        <p className="font-display font-bold text-slate-900">
                          {money(Math.ceil(r.price))}
                        </p>
                        <Button size="sm" variant="outline" onClick={reserve}>
                          Reserve
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* location */}
          {address && (
            <section>
              <h2 className="mb-2 font-display text-lg font-bold text-slate-900">
                Location
              </h2>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <p className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="h-4 w-4 text-brand-dark" /> {address}
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    detail?.lat && detail?.lng ? `${detail.lat},${detail.lng}` : `${name} ${address}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-medium text-brand-dark hover:underline"
                >
                  View on map
                </a>
              </div>
            </section>
          )}
        </div>

        {/* sticky price box */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <div className="flex items-end gap-2">
              {savings > 0 && (
                <span className="text-sm text-slate-400 line-through">
                  {money(opt.marketPrice)}
                </span>
              )}
              <span className="font-display text-2xl font-bold text-slate-900">
                {price ? money(price) : '—'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {perNight ? `${money(perNight)}/night · ` : ''}
              {nights} night{nights === 1 ? '' : 's'} · incl. taxes
            </p>

            <div className="my-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
              {flags.length === 0 ? (
                <p className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> In your travel policy
                </p>
              ) : (
                <p className="inline-flex items-center gap-1 font-semibold text-amber-600">
                  <Shield className="h-3.5 w-3.5" />{' '}
                  {needsApproval ? 'Needs manager approval' : 'Policy note'}
                </p>
              )}
              {savings > 0 && (
                <p className="font-semibold text-emerald-600">
                  Saves the company {money(savings)} vs market
                </p>
              )}
              <p className="inline-flex items-center gap-1 font-semibold text-brand-dark">
                <Gift className="h-3.5 w-3.5" /> Earn +{num(points)} points
              </p>
            </div>

            <Button className="w-full" onClick={reserve} disabled={!price}>
              {needsApproval ? 'Request this stay' : 'Reserve'}
            </Button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {checkin} → {checkout}
            </p>
          </Card>
        </div>
      </div>

      {/* lightbox */}
      {lightbox != null && images.length > 0 && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
          <div className="flex justify-end p-3">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setLightbox(null)}
              className="rounded-lg p-2 text-white/80 hover:bg-white/10"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center px-4 pb-8">
            <div className="w-full max-w-4xl">
              <HotelCarousel
                images={images}
                alt={name}
                startIndex={lightbox}
                className="h-[70vh] w-full"
                rounded="rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
