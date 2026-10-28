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
import { Lightbox } from '@/components/hotels/Lightbox';
import { RoomSelection } from '@/components/hotels/RoomSelection';
import type { ReserveArgs } from '@/components/hotels/RoomCard';
import { leadRoomPrice } from '@/lib/hotelRooms';
import { Button, Card, Field, Input, Select, cn } from '@/components/app/ui';
import { StripeCheckout } from '@/components/app/StripeCheckout';
import { HvLoader } from '@/components/HvLoader';
import { sendEmail } from '@/lib/email';
import { money, num, dateRange } from '@/lib/format';
import { Check, Shield, Gift, MapPin, Building, Sparkles, Wallet, Lock } from '@/components/icons';

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
  const { state, role, activeUser, evaluatePolicies, book, spentForScope, approvalModeFor } =
    useStore();
  const canBookForOthers = role === 'admin' || role === 'booker';
  const [travelerId, setTravelerId] = useState(params.get('travelerId') || activeUser.id);
  const [review, setReview] = useState(false);

  const eventId = params.get('eventId') || undefined;
  const eventName = params.get('eventName') || undefined;
  // Allow-listed stay for an event: pre-cleared by an admin — no policy, no approval.
  const eventAllow = params.get('eventAllow') === '1';
  const forceApproval = approvalModeFor(travelerId) === 'pre_approval' && !eventAllow;

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
  const [roomPhotos, setRoomPhotos] = useState<{ images: string[]; title: string; index: number } | null>(
    null
  );
  // The specific rate the guest picked from a room card — carries the real
  // book_hash and all-in price the booking is made against.
  const [selected, setSelected] = useState<ReserveArgs | null>(null);
  const [policyAlert, setPolicyAlert] = useState<string[] | null>(null);
  const [bookNote, setBookNote] = useState('');
  // Checkout: payment entry step + a processing overlay (like HeyVacay.co).
  const [payStep, setPayStep] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [useDifferentCard, setUseDifferentCard] = useState(false);
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

  const uiRooms = detail?.uiRooms ?? [];
  const hasRooms = uiRooms.length > 0;
  const lead = hasRooms ? leadRoomPrice(uiRooms) : null;

  // Active price: the rate the guest picked, else the lead "from" rate, else
  // the price carried over from the results card.
  const price = selected?.price ?? lead?.price ?? priceParam ?? 0;
  const market = selected?.competitive ?? marketParam;
  const perNight =
    selected?.perNight ?? lead?.pricePerDay ?? (price ? Math.round(price / nights) : 0);

  const opt: InventoryOption = {
    id: hid,
    hid,
    type: 'hotel',
    title: name,
    detail: `${nights} night${nights === 1 ? '' : 's'}`,
    price,
    marketPrice: market > price ? market : price,
    star,
    nights,
    location: address,
  };
  const flags = eventAllow ? [] : evaluatePolicies(opt, checkin || new Date().toISOString());
  const { savings, points } = rewardsFor(opt);
  const needsApproval =
    !eventAllow &&
    (forceApproval || flags.some((f) => f.policy.action === 'approve' || f.policy.action === 'block'));

  // Per-room policy check — each room card evaluates its own all-in price so a
  // cheap room can be in policy while a suite has a note / needs approval /
  // is blocked. Returns the status and the human-readable notes.
  const assessRoom = (
    priceAllIn: number
  ): { status: 'in' | 'note' | 'approval' | 'block'; notes: string[] } => {
    // Event allow-listed stays are pre-cleared — always in policy.
    if (eventAllow) return { status: 'in', notes: [] };
    const roomOpt: InventoryOption = { ...opt, price: priceAllIn };
    const fl = evaluatePolicies(roomOpt, checkin || new Date().toISOString());
    const notes = fl.map((f) => f.message);
    if (fl.some((f) => f.policy.action === 'block')) return { status: 'block', notes };
    if (fl.some((f) => f.policy.action === 'approve')) return { status: 'approval', notes };
    // Company-wide pre-approval: every room needs sign-off (policy warnings still shown).
    if (forceApproval)
      return {
        status: 'approval',
        notes: notes.length ? notes : ['Your company requires approval on all bookings.'],
      };
    if (fl.some((f) => f.policy.action === 'warn')) return { status: 'note', notes };
    return { status: 'in', notes: [] };
  };

  // Commit the booking (after payment / approval decision).
  const commitBooking = () => {
    book({
      opt,
      travelerId,
      startDate: checkin,
      endDate: checkout,
      roomType: selected?.roomTitle,
      images,
      travelerNote: bookNote.trim() || undefined,
      eventId,
      eventName,
      bypassPolicy: eventAllow,
    });
    setConfirmed({ pending: needsApproval, points });
    setReview(false);
    setPayStep(false);
    setProcessing(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Notify by email (no-ops without a provider key; real send when set).
    const trav = state.users.find((u) => u.id === travelerId);
    const manager = state.users.find((u) => u.role === 'admin');
    const emailData = {
      travelerName: trav?.name ?? 'there',
      title: name,
      roomType: selected?.roomTitle,
      dates: dateRange(checkin, checkout),
      total: price,
      savings,
      points,
      inPolicy: flags.length === 0,
    };
    if (needsApproval) {
      if (manager?.email)
        sendEmail('approvalPending', manager.email, {
          ...emailData,
          manager: manager.name,
          note: bookNote.trim() || undefined,
        });
    } else if (trav?.email) {
      sendEmail('confirmation', trav.email, emailData);
    }
  };

  // Simulate payment processing then commit (demo or "real" both run this).
  const processAndBook = () => {
    setProcessing(true);
    setTimeout(commitBooking, 1600);
  };

  const savedCard = state.billing?.mode === 'card' && !!state.billing?.cardLast4;

  // "Request this stay" / "Confirm booking" primary action.
  const reserve = () => {
    if (needsApproval) {
      // Approvals route to an admin — no payment taken up front.
      commitBooking();
    } else if (state.billing?.mode === 'net30') {
      // Invoiced — nothing to collect, book straight through.
      setReview(false);
      processAndBook();
    } else {
      // Employee card, or company card on file — show the checkout step.
      setUseDifferentCard(false);
      setReview(false);
      setPayStep(true);
    }
  };

  const onReserveRoom = (args: ReserveArgs) => {
    setSelected(args);
    // A policy note (warn) requires an acknowledgement, not approval — show a
    // full-screen alert the traveler must accept before continuing.
    if (args.policy === 'note' && args.policyNotes.length > 0) {
      setPolicyAlert(args.policyNotes);
    } else {
      setReview(true);
    }
  };

  const scrollToRooms = () => {
    document.getElementById('select-room')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  // Budget check for the chosen traveler.
  const empBudget = state.budgets.find(
    (b) => b.scope === 'employee' && b.refId === travelerId
  );
  const budgetLimit = empBudget?.limit;
  const spent = empBudget ? spentForScope('employee', travelerId) : 0;
  const overBudget = budgetLimit != null ? spent + price > budgetLimit : false;

  if (confirmed) {
    return (
      <Card className="mx-auto max-w-xl">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">
            {confirmed.pending ? 'Sent for approval' : 'Booking confirmed!'}
          </h2>
          <p className="mt-1 text-slate-500">
            {confirmed.pending
              ? 'Your manager will review and decide shortly.'
              : 'Your stay is booked. Have a great trip!'}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 p-4">
          <p className="font-semibold text-slate-900">{name}</p>
          {selected?.roomTitle && <p className="text-sm text-slate-500">{selected.roomTitle}</p>}
          <p className="text-sm text-slate-400">
            {dateRange(checkin, checkout)} · {nights} night{nights === 1 ? '' : 's'}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Total</p>
              <p className="font-display font-bold text-slate-900">{money(price)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-600">Saved your company</p>
              <p className="font-display font-bold text-emerald-700">{money(savings)}</p>
            </div>
            <div className="rounded-xl bg-brand/10 p-3">
              <p className="text-xs text-brand-dark">Points</p>
              <p className="font-display font-bold text-brand-dark">+{num(confirmed.points)}</p>
            </div>
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
            {flags.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-sky-600">
                <Check className="h-4 w-4" /> In your travel policy
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-600">
                <Shield className="h-4 w-4" /> {needsApproval ? 'Pending manager approval' : 'Policy note acknowledged'}
              </span>
            )}
          </p>
        </div>

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
        {rating != null && rating > 0 && (
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

      {eventAllow && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Allow-listed for <span className="font-semibold">{eventName ?? 'your event'}</span> — this
            stay books instantly, no approval needed, even if it&apos;s outside normal policy.
          </span>
        </div>
      )}
      {forceApproval && !eventAllow && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>Your company requires manager approval on all bookings — this stay will be sent for approval.</span>
        </div>
      )}

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

          {/* rooms */}
          {hasRooms && (
            <RoomSelection
              uiRooms={uiRooms}
              onReserve={onReserveRoom}
              onPhotos={(imgs, title, index) =>
                setRoomPhotos({ images: imgs, title, index })
              }
              assessPolicy={assessRoom}
            />
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
            {!selected && hasRooms && (
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                From
              </p>
            )}
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
            {selected && (
              <p className="mt-1 text-xs font-medium text-slate-600">
                {selected.roomTitle}
              </p>
            )}

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
              {overBudget && budgetLimit != null && (
                <p className="inline-flex items-center gap-1 font-semibold text-amber-600">
                  <Wallet className="h-3.5 w-3.5" /> Over the {money(budgetLimit)} travel budget
                </p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => {
                if (loading) return;
                // Always send people to pick a room when rooms exist and none
                // is chosen yet — don't open the booking modal mid-load.
                if (hasRooms && !selected) scrollToRooms();
                else if (selected || !hasRooms) setReview(true);
              }}
              disabled={loading || !price}
            >
              {loading
                ? 'Loading rooms…'
                : hasRooms && !selected
                  ? 'Select your room'
                  : needsApproval
                    ? 'Request this stay'
                    : 'Reserve'}
            </Button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {checkin} → {checkout}
            </p>
          </Card>
        </div>
      </div>

      {/* review / checkout */}
      {review && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
          onClick={() => setReview(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Review &amp; book
              </h2>
              <button
                onClick={() => setReview(false)}
                aria-label="Close"
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-800">{name}</p>
                <p className="text-sm text-slate-400">
                  {dateRange(checkin, checkout)} · {nights} night
                  {nights === 1 ? '' : 's'}
                </p>
                {selected && (
                  <div className="mt-2 rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-800">
                      {selected.roomTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[selected.refund, selected.meal]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {eventName && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-dark">
                      <Sparkles className="h-3 w-3" /> {eventName}
                    </span>
                  )}
                  {eventAllow ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <Check className="h-3 w-3" /> Pre-approved · books instantly
                    </span>
                  ) : needsApproval ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <Shield className="h-3 w-3" /> Needs manager approval
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <Check className="h-3 w-3" /> Books instantly
                    </span>
                  )}
                </div>
              </div>

              {canBookForOthers && (
                <Field label="Guest">
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
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total ({nights}n)</span>
                  <span className="font-semibold text-slate-900">{money(price)}</span>
                </div>
                {savings > 0 && (
                  <div className="mt-1 flex justify-between">
                    <span className="text-slate-500">Saved vs market</span>
                    <span className="font-semibold text-emerald-600">{money(savings)}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between">
                  <span className="text-slate-500">Points earned</span>
                  <span className="font-semibold text-brand-dark">+{num(points)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-slate-500">Payment</span>
                  <span className="font-semibold text-slate-700">
                    {state.billing?.mode === 'net30'
                      ? 'Billed to company · Net 30'
                      : state.billing?.mode === 'card'
                        ? `Company card ${state.billing.cardLast4 ? `•••• ${state.billing.cardLast4}` : 'on file'}`
                        : 'You enter payment at checkout'}
                  </span>
                </div>
              </div>

              {flags.length > 0 && (
                <div className="space-y-1.5">
                  {flags.map((f, i) => (
                    <p
                      key={i}
                      className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800"
                    >
                      <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      {f.message}
                    </p>
                  ))}
                </div>
              )}

              {overBudget && budgetLimit != null && (
                <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> This
                  puts the guest over their {money(budgetLimit)} travel budget.
                </p>
              )}

              {needsApproval && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Add a note for your approver (optional)
                  </label>
                  <textarea
                    value={bookNote}
                    onChange={(e) => setBookNote(e.target.value)}
                    rows={2}
                    placeholder="Why this stay? Anything they should know…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                  />
                </div>
              )}

              <Button className="w-full" onClick={reserve} disabled={!price}>
                {needsApproval ? 'Request this stay' : 'Confirm booking'}
              </Button>
              {needsApproval && (
                <p className="text-center text-[11px] text-slate-400">
                  Routes to an admin for approval.{' '}
                  {opt.freeCancellation
                    ? 'Free-cancellation rate — held at no risk.'
                    : 'Non-refundable — re-priced live at approval.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* payment / checkout step */}
      {payStep && !processing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
          onClick={() => setPayStep(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
                <Lock className="h-4 w-4 text-brand-dark" /> Secure checkout
              </h2>
              <button onClick={() => setPayStep(false)} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">
                ✕
              </button>
            </div>
            <div className="grid gap-0 sm:grid-cols-[1fr_1.1fr]">
              {/* order summary */}
              <div className="space-y-3 border-b border-slate-100 bg-slate-50 p-5 sm:border-b-0 sm:border-r">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Your booking
                </p>
                {images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[0]} alt="" className="h-28 w-full rounded-xl object-cover" />
                )}
                <div>
                  <p className="font-semibold text-slate-900">{name}</p>
                  {selected?.roomTitle && <p className="text-sm text-slate-500">{selected.roomTitle}</p>}
                  <p className="text-xs text-slate-400">
                    {dateRange(checkin, checkout)} · {nights} night{nights === 1 ? '' : 's'}
                  </p>
                </div>
                {eventName && (
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-dark">
                    <Sparkles className="h-3 w-3" /> {eventName}
                  </p>
                )}
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Room ({nights}n)</span>
                    <span className="text-slate-800">{money(price)}</span>
                  </div>
                  {savings > 0 && (
                    <div className="mt-1 flex justify-between text-xs">
                      <span className="text-slate-400">Saved vs market</span>
                      <span className="font-semibold text-emerald-600">{money(savings)}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-baseline justify-between border-t border-slate-100 pt-2">
                    <span className="font-semibold text-slate-700">Total due</span>
                    <span className="font-display text-xl font-bold text-slate-900">{money(price)}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">Taxes & fees included. +{num(points)} points on this trip.</p>
              </div>

              {/* payment */}
              <div className="space-y-4 p-5">
                {savedCard && !useDifferentCard ? (
                  <>
                    <p className="text-sm font-semibold text-slate-800">Pay with company card</p>
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                      <span className="grid h-9 w-12 place-items-center rounded-md bg-navy text-[10px] font-bold text-white">
                        {state.billing?.cardBrand ?? 'CARD'}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">•••• •••• •••• {state.billing?.cardLast4}</p>
                        <p className="text-xs text-slate-400">Company card on file</p>
                      </div>
                      <Check className="h-4 w-4 text-emerald-500" />
                    </div>
                    <Button className="w-full" onClick={processAndBook}>
                      Confirm &amp; pay {money(price)}
                    </Button>
                    <button
                      onClick={() => setUseDifferentCard(true)}
                      className="w-full text-center text-xs font-medium text-brand-dark hover:underline"
                    >
                      Use a different card
                    </button>
                  </>
                ) : (
                  <StripeCheckout amount={price} description={name} onPaid={processAndBook} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* processing overlay */}
      {processing && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-white/95">
          <div className="text-center">
            <HvLoader />
            <p className="mt-4 font-display text-lg font-semibold text-slate-700">
              Processing your booking…
            </p>
            <p className="text-sm text-slate-400">Hang tight, this only takes a moment.</p>
          </div>
        </div>
      )}

      {/* policy note — full-screen acknowledgement */}
      {policyAlert && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/60 p-5">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-lime-50 text-lime-600">
              <Shield className="h-6 w-6" />
            </span>
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              Heads up — a policy note applies
            </h2>
            <ul className="mt-3 space-y-1.5 text-left text-sm text-slate-600">
              {policyAlert.map((n, i) => (
                <li key={i} className="rounded-lg bg-slate-50 p-2">{n}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              You can still book this stay — your company just wants you to be aware.
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => {
                setPolicyAlert(null);
                setReview(true);
              }}
            >
              I understand — continue
            </Button>
          </div>
        </div>
      )}

      {/* gallery lightbox */}
      {lightbox != null && images.length > 0 && (
        <Lightbox
          images={images}
          startIndex={lightbox}
          title={name}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* room photos lightbox */}
      {roomPhotos && roomPhotos.images.length > 0 && (
        <Lightbox
          images={roomPhotos.images}
          startIndex={roomPhotos.index}
          title={roomPhotos.title}
          onClose={() => setRoomPhotos(null)}
        />
      )}
    </div>
  );
}
