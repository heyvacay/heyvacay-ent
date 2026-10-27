'use client';

import { useStore } from '@/lib/store';
import { Button } from '@/components/app/ui';
import { BookingChat } from '@/components/app/BookingChat';
import { money } from '@/lib/format';
import { Sparkles } from '@/components/icons';

/**
 * Shows the traveler any manager counter-offers ("approve if changed") waiting
 * on them, with the manager's message and accept / decline. Renders nothing
 * when there are none.
 */
export function OfferBanner() {
  const { state, activeUser, respondOffer } = useStore();

  const offers = state.bookings.filter(
    (b) => b.travelerId === activeUser.id && b.offer?.status === 'offered'
  );
  if (offers.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {offers.map((b) => {
        const o = b.offer!;
        const oldPrice = o.oldPrice ?? b.price;
        const saving =
          o.newPrice != null && oldPrice > o.newPrice ? oldPrice - o.newPrice : 0;
        const extra =
          o.newPrice != null && o.newPrice > oldPrice ? o.newPrice - oldPrice : 0;
        return (
          <div key={b.id} className="overflow-hidden rounded-2xl border border-brand/30 bg-brand/5">
            <div className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Sparkles className="h-4 w-4 text-brand-dark" /> {o.by} proposed a change to your trip
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{b.title}</p>
              <p className="mt-1 text-sm text-slate-600">{o.note}</p>

              {/* full before → after summary */}
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="grid sm:grid-cols-2">
                  {/* before */}
                  <div className="border-b border-slate-100 p-4 sm:border-b-0 sm:border-r">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Current
                    </p>
                    {b.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.images[0]}
                        alt=""
                        className="mt-2 h-28 w-full rounded-lg object-cover"
                      />
                    )}
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {o.oldRoomType ?? b.roomType ?? 'Your room'}
                    </p>
                    <p className="text-sm text-slate-500">{money(oldPrice)} total</p>
                  </div>
                  {/* after */}
                  <div className="bg-brand/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
                      Proposed
                    </p>
                    {(o.newImage || b.images?.[0]) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.newImage || b.images![0]}
                        alt=""
                        className="mt-2 h-28 w-full rounded-lg object-cover"
                      />
                    )}
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {o.newRoomType ?? o.oldRoomType ?? b.roomType ?? 'Updated room'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {money(o.newPrice ?? oldPrice)} total
                      {saving > 0 && (
                        <span className="ml-1 font-semibold text-emerald-600">
                          · saves {money(saving)}
                        </span>
                      )}
                      {extra > 0 && (
                        <span className="ml-1 font-semibold text-amber-600">
                          · +{money(extra)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => respondOffer(b.id, true)}>
                  Accept {saving > 0 ? `& save ${money(saving)}` : 'offer'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => respondOffer(b.id, false)}>
                  Decline
                </Button>
              </div>
              <div className="mt-3 sm:max-w-md">
                <BookingChat bookingId={b.id} role="traveler" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
