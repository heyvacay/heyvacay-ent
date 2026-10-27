'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
} from '@/components/app/ui';
import { money, num, dateRange } from '@/lib/format';
import { sendEmail } from '@/lib/email';
import { BookingChat } from '@/components/app/BookingChat';
import { getHotelDetail } from '@/lib/search';
import {
  defaultSelection,
  resolveLeaf,
  sumPayAtProperty,
  toTitleCase,
  type UiRoom,
} from '@/lib/hotelRooms';
import { Plane, Receipt, Shield, Check, Gift, Wallet } from '@/components/icons';

/** Representative all-in total for a room (default bed/refund/meal). */
function roomAllIn(room: UiRoom): { title: string; price: number; image?: string } | null {
  const sel = defaultSelection(room);
  const leaf = resolveLeaf(room, sel);
  const rate = leaf?.meal.rateRef;
  if (!rate) return null;
  const pap = sumPayAtProperty(rate.taxes_fees);
  return {
    title: toTitleCase(room.roomTitle),
    price: Math.ceil((rate.price || 0) + pap),
    image: room.images[0],
  };
}

export default function ApprovalDetail({ id }: { id: string }) {
  const { state, userById, spentForScope, approveBooking, cancelBooking, proposeChange, activeUser } =
    useStore();
  const [note, setNote] = useState('');
  const [noteVisible, setNoteVisible] = useState(true);
  const [done, setDone] = useState<null | 'approved' | 'declined' | 'offered'>(null);
  // "Approve if changed" counter-offer form.
  const [offerMode, setOfferMode] = useState(false);
  const [offer, setOffer] = useState({ note: '', newRoomType: '', newPrice: 0 });
  const [rooms, setRooms] = useState<UiRoom[] | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // When proposing a change on a hotel booking, load its real room options so
  // the manager can pick a different room (with photos) by a click.
  const b0 = state.bookings.find((x) => x.id === id);
  useEffect(() => {
    if (!offerMode || rooms !== null || !b0 || b0.type !== 'hotel' || !b0.hid) return;
    setLoadingRooms(true);
    getHotelDetail({ hid: b0.hid, checkin: b0.startDate, checkout: b0.endDate, adults: 1 })
      .then((d) => setRooms(d.uiRooms))
      .catch(() => setRooms([]))
      .finally(() => setLoadingRooms(false));
  }, [offerMode, rooms, b0]);

  const b = state.bookings.find((x) => x.id === id);

  if (!b) {
    return (
      <div>
        <Link href="/app/approvals" className="text-sm font-medium text-brand-dark hover:underline">
          ← Back to approvals
        </Link>
        <div className="mt-4">
          <EmptyState title="Trip not found" sub="It may have been removed." />
        </div>
      </div>
    );
  }

  const traveler = userById(b.travelerId);
  const booker = userById(b.bookedById);
  const empBudget = state.budgets.find(
    (x) => x.scope === 'employee' && x.refId === b.travelerId
  );
  const deptBudget = state.budgets.find(
    (x) => x.scope === 'department' && x.refId === b.department
  );
  const budget = empBudget ?? deptBudget;
  const spent = empBudget
    ? spentForScope('employee', b.travelerId)
    : spentForScope('department', b.department);
  const afterPct =
    budget && budget.limit > 0
      ? Math.min(100, Math.round(((spent + b.price) / budget.limit) * 100))
      : null;
  const overBudget = budget ? spent + b.price > budget.limit : false;

  const priceHoldNote =
    b.type === 'hotel'
      ? b.freeCancellation
        ? 'Free-cancellation rate — the price is held by the reservation. If you decline, it cancels at no cost before the deadline.'
        : 'Non-refundable rate — RateHawk prices are live and cannot be held, so the fare is re-confirmed the moment you approve. If it has moved materially, the traveler is asked to re-confirm before it books.'
      : 'Airfare is re-priced at ticketing — approve promptly to lock the quoted fare; a material change bounces back to the traveler.';

  const decide = (kind: 'approved' | 'declined') => {
    const comment = note.trim() || undefined;
    if (kind === 'approved') approveBooking(b.id, comment, noteVisible);
    else cancelBooking(b.id, comment, noteVisible);
    setDone(kind);
    if (traveler?.email) {
      sendEmail('approvalDecided', traveler.email, {
        travelerName: traveler.name,
        title: b.title,
        approved: kind === 'approved',
        note: noteVisible ? comment : undefined,
      });
    }
  };

  const sendOffer = () => {
    if (!offer.note.trim() && !offer.newRoomType.trim() && !offer.newPrice) return;
    proposeChange(b.id, {
      note: offer.note.trim() || 'Proposed a change to your booking.',
      newRoomType: offer.newRoomType.trim() || undefined,
      newPrice: offer.newPrice > 0 ? offer.newPrice : undefined,
      by: activeUser.name,
    });
    setDone('offered');
  };

  const pending = b.status === 'pending_approval';

  return (
    <div className="pb-10">
      <Link
        href="/app/approvals"
        className="text-sm font-medium text-brand-dark hover:underline"
      >
        ← Back to approvals
      </Link>

      <PageHeader
        title="Review trip"
        subtitle="Everything you need to make the call — in one place."
      />

      {done && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <p className="font-semibold text-emerald-700">
            {done === 'approved'
              ? 'Trip approved — points awarded to the traveler.'
              : done === 'declined'
                ? 'Trip declined.'
                : 'Offer sent — the traveler will see it on their home page and can accept or decline.'}
          </p>
          <div className="mt-3">
            <Button href="/app/approvals" size="sm">
              Back to approvals
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* photos of the requested stay */}
          {b.images && b.images.length > 0 && (
            <div className="grid grid-cols-4 gap-2 overflow-hidden rounded-2xl" style={{ height: 180 }}>
              {b.images.slice(0, 4).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className={`h-full w-full object-cover ${i === 0 ? 'col-span-2 row-span-1' : ''}`}
                />
              ))}
            </div>
          )}

          {/* itinerary */}
          <Card>
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                {b.type === 'flight' ? (
                  <Plane className="h-6 w-6" />
                ) : (
                  <Receipt className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    {b.title}
                  </h2>
                  {b.status === 'pending_approval' && (
                    <Badge color="amber">
                      <Shield className="h-3 w-3" /> Needs approval
                    </Badge>
                  )}
                  {b.status === 'confirmed' && <Badge color="green">Approved</Badge>}
                  {b.status === 'cancelled' && <Badge color="slate">Declined</Badge>}
                </div>
                <p className="mt-0.5 text-slate-500">{b.detail}</p>
                {b.roomType && (
                  <p className="mt-0.5 text-sm font-medium text-slate-600">
                    Room requested: {b.roomType}
                  </p>
                )}
                {b.travelerNote && (
                  <p className="mt-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-700">Traveler&apos;s note:</span>{' '}
                    {b.travelerNote}
                  </p>
                )}
                <p className="mt-1 text-sm text-slate-400">
                  {dateRange(b.startDate, b.endDate)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Price</p>
                <p className="font-display text-lg font-bold text-slate-900">
                  {money(b.price)}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-600">Saved vs market</p>
                <p className="font-display text-lg font-bold text-emerald-700">
                  {money(b.savings)}
                </p>
              </div>
              <div className="rounded-xl bg-brand/10 p-4">
                <p className="text-xs text-brand-dark">Points</p>
                <p className="font-display text-lg font-bold text-brand-dark">
                  +{num(b.pointsEarned)}
                </p>
              </div>
            </div>
          </Card>

          {/* policy breakdown */}
          <Card>
            <h3 className="mb-3 font-display text-lg font-bold text-slate-900">
              Why this needs a decision
            </h3>
            {b.policyNotes && b.policyNotes.length > 0 ? (
              <ul className="space-y-2">
                {b.policyNotes.map((n, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
                  >
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <Check className="h-4 w-4" /> This trip is within policy.
              </p>
            )}
          </Card>

          {/* budget impact */}
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
              <Wallet className="h-5 w-5 text-brand-dark" /> Budget impact
            </h3>
            {budget ? (
              <>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {empBudget ? `${traveler?.name}'s budget` : `${b.department} budget`}
                  </span>
                  <span
                    className={
                      overBudget ? 'font-semibold text-amber-600' : 'text-slate-600'
                    }
                  >
                    {money(spent + b.price)} of {money(budget.limit)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${overBudget ? 'bg-amber-500' : 'bg-brand'}`}
                    style={{ width: `${afterPct ?? 0}%` }}
                  />
                </div>
                {overBudget && (
                  <p className="mt-2 text-sm font-medium text-amber-600">
                    Approving this trip puts the {empBudget ? 'traveler' : 'department'} over budget.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">No budget set for this traveler.</p>
            )}
          </Card>

          {/* price hold */}
          <Card className="bg-slate-50">
            <h3 className="mb-1 font-display text-sm font-bold text-slate-900">
              Price &amp; cancellation
            </h3>
            <p className="text-sm text-slate-500">{priceHoldNote}</p>
          </Card>

          {/* chat with traveler */}
          <BookingChat bookingId={b.id} role="manager" />
        </div>

        {/* decision rail */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <h3 className="font-display text-lg font-bold text-slate-900">
              Traveler
            </h3>
            <div className="mt-2 flex items-center gap-3">
              <Avatar name={traveler?.name ?? '?'} />
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">
                  {traveler?.name}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {traveler?.title} · {b.department}
                </p>
                {traveler?.email && (
                  <p className="truncate text-xs text-slate-400">{traveler.email}</p>
                )}
              </div>
            </div>
            {booker && booker.id !== b.travelerId && (
              <p className="mt-2 text-xs text-slate-400">Booked by {booker.name}</p>
            )}

            <div className="mt-5 border-t border-slate-100 pt-4">
              {pending && !done ? (
                <>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Add a comment
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Optional note to the traveler…"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={noteVisible}
                      onChange={(e) => setNoteVisible(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    Make this comment visible to the traveler
                  </label>
                  <div className="mt-3 flex gap-2">
                    <Button className="flex-1" onClick={() => decide('approved')}>
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => decide('declined')}
                    >
                      Decline
                    </Button>
                  </div>

                  {/* Approve if changed */}
                  <button
                    onClick={() => setOfferMode((v) => !v)}
                    className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {offerMode ? 'Cancel offer' : 'Approve if changed…'}
                  </button>
                  {offerMode && (
                    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">
                        Pick a different room below — the traveler gets the offer and, on accept,
                        it books instantly.
                      </p>

                      {b.type === 'hotel' && b.hid ? (
                        <div className="max-h-72 space-y-2 overflow-auto">
                          {loadingRooms && <p className="text-xs text-slate-400">Loading rooms…</p>}
                          {rooms?.map((room) => {
                            const info = roomAllIn(room);
                            if (!info) return null;
                            const chosen = offer.newRoomType === info.title;
                            const diff = b.price - info.price;
                            return (
                              <button
                                key={room.roomKey}
                                onClick={() =>
                                  setOffer({
                                    ...offer,
                                    newRoomType: info.title,
                                    newPrice: info.price,
                                    note:
                                      offer.note ||
                                      `Proposed ${info.title}${diff > 0 ? ` — saves ${money(diff)}` : ''}.`,
                                  })
                                }
                                className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left transition ${
                                  chosen ? 'border-brand bg-brand/5' : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                {info.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={info.image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                                ) : (
                                  <span className="h-12 w-12 shrink-0 rounded-md bg-slate-100" />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-slate-800">{info.title}</span>
                                  <span className="block text-xs text-slate-400">{money(info.price)} total</span>
                                </span>
                                {diff > 0 && (
                                  <span className="shrink-0 text-xs font-semibold text-emerald-600">
                                    −{money(diff)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {rooms && rooms.length === 0 && !loadingRooms && (
                            <p className="text-xs text-slate-400">No live room options available.</p>
                          )}
                        </div>
                      ) : (
                        <input
                          value={offer.newRoomType}
                          onChange={(e) => setOffer({ ...offer, newRoomType: e.target.value })}
                          placeholder="What to change"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                        />
                      )}

                      {offer.newPrice > 0 && (
                        <div className="rounded-lg bg-white p-2 text-xs text-slate-600">
                          New total <span className="font-semibold">{money(offer.newPrice)}</span>
                          {b.price - offer.newPrice > 0 && (
                            <span className="ml-1 font-semibold text-emerald-600">
                              · saves {money(b.price - offer.newPrice)}
                            </span>
                          )}
                        </div>
                      )}

                      <textarea
                        value={offer.note}
                        onChange={(e) => setOffer({ ...offer, note: e.target.value })}
                        rows={2}
                        placeholder="Message to the traveler…"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                      />
                      <Button className="w-full" onClick={sendOffer} disabled={!offer.newRoomType && !offer.note.trim()}>
                        Send offer to traveler
                      </Button>
                    </div>
                  )}

                  <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <Gift className="h-3 w-3" /> Approving awards the traveler{' '}
                    {num(b.pointsEarned)} points.
                  </p>
                </>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {b.status === 'confirmed' ? 'Approved' : 'Declined'}
                  </p>
                  {b.reviewNote && (
                    <p className="mt-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-500">
                      “{b.reviewNote}”
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
