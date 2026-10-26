'use client';

import { useStore } from '@/lib/store';
import { Button } from '@/components/app/ui';
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
      {offers.map((b) => (
        <div key={b.id} className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Sparkles className="h-4 w-4 text-brand-dark" /> {b.offer!.by} proposed a change to your trip
          </p>
          <p className="mt-1 text-sm text-slate-600">{b.offer!.note}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
            <span className="font-medium">{b.title}</span>
            {b.offer!.newRoomType && <span>New room: {b.offer!.newRoomType}</span>}
            {b.offer!.newPrice != null && <span>New total: {money(b.offer!.newPrice)}</span>}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => respondOffer(b.id, true)}>
              Accept offer
            </Button>
            <Button size="sm" variant="outline" onClick={() => respondOffer(b.id, false)}>
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
