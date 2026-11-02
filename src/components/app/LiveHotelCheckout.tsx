'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button } from '@/components/app/ui';
import { money } from '@/lib/format';
import type { ReserveArgs } from '@/components/hotels/RoomCard';
import type { HotelDetailData } from '@/lib/search';
import {
  buildPrebookPayload,
  prebook,
  bookingForm,
  paymentInit,
  buildConfirmPayload,
  confirmBooking,
  pollStatus,
  type LiveGuest,
} from '@/lib/liveBooking';

/**
 * The real hotel checkout: prebook → booking form → payment init → Stripe card
 * confirmation → confirm (finish + capture) → status poll, all against the
 * shared HeyVacay backend via the service-account proxy. Mirrors heyvacay.co.
 *
 * Only mounted when live booking is configured. If the server says live booking
 * is off (501) it calls onFallback so the page runs the workspace-record demo
 * flow instead. A supplier-side problem (price changed, sold out) calls
 * onUnavailable with a plain-English reason so the traveler can re-pick.
 */
export function LiveHotelCheckout({
  hid,
  detail,
  rate,
  checkin,
  checkout,
  adults,
  guest,
  amount,
  onConfirmed,
  onUnavailable,
  onFallback,
}: {
  hid: string;
  detail: HotelDetailData;
  rate: ReserveArgs;
  checkin: string;
  checkout: string;
  adults: number;
  guest: LiveGuest;
  amount: number;
  onConfirmed: (bookingRef: string, paymentIntentId?: string) => void;
  onUnavailable: (message: string) => void;
  onFallback: () => void;
}) {
  // The card form is shown immediately; the room hold + payment init run in the
  // background while the traveler fills in their card. 'collect' is the normal
  // state (form visible, button gated on background readiness).
  type Phase = 'collect' | 'processing' | 'error' | 'pending';
  const [phase, setPhase] = useState<Phase>('collect');
  const [error, setError] = useState('');
  const [pendingRef, setPendingRef] = useState('');
  const [pk, setPk] = useState('');
  // Set once the background prep (prebook → form → payment init) has a usable
  // payment intent; this is what flips the button to "Complete booking".
  const [clientSecret, setClientSecret] = useState('');
  // The amount we actually charge — starts at the quoted total, updated if the
  // supplier's confirmed price changed during the room hold.
  const [chargeAmount, setChargeAmount] = useState(amount);
  // A price change surfaced during the hold: show it, then continue.
  const [priceNote, setPriceNote] = useState<{ dropped: boolean; amount: number } | null>(
    null
  );
  // Carried from payment-init into confirm.
  const session = useRef<{
    bookingRef: string;
    payUuid?: string;
    initUuid?: string;
    orderId?: string;
  } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        // Gate: is live booking configured at all?
        const cfg = await fetch('/api/payments/config').then((r) => r.json());
        if (!cfg?.liveBooking) {
          onFallback();
          return;
        }

        // --- Background: hold the room and set up the payment intent while the
        // traveler sees the checkout. The card form mounts once we know which
        // Stripe account minted the intent (see below). ---
        const pre = await prebook(
          buildPrebookPayload({ hid, detail, rate, checkin, checkout, adults })
        );
        if (pre.errorType === 'live_booking_disabled') {
          onFallback();
          return;
        }
        if (!pre.bookingRef) {
          onUnavailable(
            pre.errorType === 'no_longer_available'
              ? 'That rate just sold out. Please pick another room.'
              : pre.message || 'We could not lock in that room. Please try another.'
          );
          return;
        }

        // Price changed during the hold? Don't abort — recompute our charge at
        // the new price (the markup is linear, so scale by the net ratio) and
        // tell the traveler, then keep going.
        let chargeNow = amount;
        if (pre.priceChanged && pre.priceChange && pre.priceChange.previousAmount > 0) {
          const ratio = pre.priceChange.newAmount / pre.priceChange.previousAmount;
          chargeNow = Math.max(1, Math.ceil(amount * ratio));
          const dropped = pre.priceDropped === true || chargeNow < amount;
          setChargeAmount(chargeNow);
          setPriceNote({ dropped, amount: chargeNow });
        }

        await bookingForm(pre.bookingRef); // surfaces payment types; backend also sets the order up

        const init = await paymentInit({
          bookingRef: pre.bookingRef,
          amount: chargeNow,
          currency: rate.currency || 'USD',
        });
        if (!init.clientSecret) {
          const backendMsg =
            (init.raw?.message as string) || (init.raw?.error as string) || '';
          setError(
            backendMsg
              ? `Payment could not be initialized: ${backendMsg}`
              : 'Payment could not be initialized. Please try again.'
          );
          setPhase('error');
          return;
        }

        session.current = {
          bookingRef: pre.bookingRef,
          payUuid: init.payUuid,
          initUuid: init.initUuid,
          orderId: init.orderId,
        };
        // Mount Stripe with the key for the account that CREATED the intent —
        // the backend's. Confirming with the enterprise app's own key fails with
        // "No such payment_intent". Fall back to the local key only if the
        // backend didn't return one.
        setPk(init.publishableKey || cfg.publishableKey || '');
        setClientSecret(init.clientSecret); // room held → button enables
      } catch {
        setError('Something went wrong starting checkout. Please try again.');
        setPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (pk ? loadStripe(pk) : null),
    [pk]
  );

  const finalize = async (): Promise<void> => {
    const s = session.current;
    if (!s) return;
    setPhase('processing');
    const payload = buildConfirmPayload({
      bookingRef: s.bookingRef,
      bookHash: rate.bookHash,
      guest,
      amount: chargeAmount,
      payUuid: s.payUuid,
      initUuid: s.initUuid,
      paymentIntentId: s.orderId,
    });
    const res = await confirmBooking(payload);
    if (res.errorType) {
      setError(res.message || 'We could not finalize the booking. Your card was not charged.');
      setPhase('error');
      return;
    }
    const ref = res.bookingRef || s.bookingRef;
    // Already terminal?
    if (res.status === 'confirmed') {
      onConfirmed(ref, s.orderId);
      return;
    }
    if (res.status && ['failed', 'error', 'cancelled'].includes(res.status)) {
      setError('The supplier could not confirm this stay. Your card was not charged.');
      setPhase('error');
      return;
    }
    // Poll until the supplier confirms. We only report a confirmed booking when
    // the supplier actually confirms — never on a timeout (that's exactly the
    // "said booked but wasn't" trap).
    const poll = await pollStatus(ref);
    if (poll.ok) {
      onConfirmed(ref, s.orderId);
      return;
    }
    if (poll.failed) {
      setError('The supplier could not confirm this stay. Your card was not charged.');
      setPhase('error');
      return;
    }
    // Still processing past our window: don't claim success. Surface the ref so
    // it can be checked in Nova / the backend.
    setPendingRef(ref);
    setPhase('pending');
  };

  if (phase === 'processing') {
    return (
      <div className="grid place-items-center gap-3 py-10 text-slate-500">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
        <p className="text-sm">Confirming your stay with the hotel…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        <Button variant="outline" className="w-full" onClick={() => onUnavailable(error)}>
          Back to rooms
        </Button>
      </div>
    );
  }

  if (phase === 'pending') {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Your payment went through and the hotel is still confirming this stay. It hasn&apos;t
          confirmed yet, so we haven&apos;t marked it booked. Reference{' '}
          <span className="font-mono font-semibold">{pendingRef}</span> — you can track it in Nova;
          it&apos;ll confirm or auto-refund shortly.
        </p>
        <Button variant="outline" className="w-full" onClick={() => onUnavailable('')}>
          Close
        </Button>
      </div>
    );
  }

  // Once the room is held and the intent exists, mount the real card form on the
  // Stripe account that minted the intent (the backend's key, set above).
  if (stripePromise && clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: { theme: 'stripe', variables: { colorPrimary: '#10c3d4' } },
        }}
      >
        <LivePayForm amount={chargeAmount} priceNote={priceNote} onAuthorized={finalize} />
      </Elements>
    );
  }

  // While the room is being held in the background: show the checkout with a
  // card-shaped placeholder and a disabled "Holding your room…" button, instead
  // of a blocking full-screen spinner.
  return <HoldingPlaceholder amount={chargeAmount} />;
}

/** The checkout shell shown while the room hold + payment init run. */
function HoldingPlaceholder({ amount }: { amount: number }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-slate-200/60 p-3">
        <div className="h-10 animate-pulse rounded-lg bg-slate-200/60" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 animate-pulse rounded-lg bg-slate-200/60" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-200/60" />
        </div>
      </div>
      <Button className="w-full" disabled>
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]" />
        Holding your room…
      </Button>
      <p className="text-center text-[11px] text-slate-400">
        We’re holding your room — your card details load in a moment. Total {money(amount)}.
      </p>
    </div>
  );
}

function LivePayForm({
  amount,
  priceNote,
  onAuthorized,
}: {
  amount: number;
  priceNote: { dropped: boolean; amount: number } | null;
  onAuthorized: () => void | Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    // clientSecret is supplied via the Elements provider, so confirmPayment
    // reads it from there — no elements.submit() needed in this mode.
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    if (err) {
      setError(err.message || 'Payment could not be authorized.');
      setBusy(false);
      return;
    }
    // Card authorized (manual capture); the backend captures on confirm.
    await onAuthorized();
  };

  return (
    <div className="space-y-4">
      {priceNote && (
        <div
          className={`rounded-lg p-3 text-sm ${
            priceNote.dropped
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          {priceNote.dropped ? (
            <>
              <span className="font-semibold">Good news — the price dropped.</span> Your
              new total is {money(priceNote.amount)}. Complete your booking below.
            </>
          ) : (
            <>
              <span className="font-semibold">Heads up — the price changed.</span> The
              new total is {money(priceNote.amount)}. Complete your booking below to lock
              it in.
            </>
          )}
        </div>
      )}
      <PaymentElement />
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      <Button className="w-full" onClick={pay} disabled={busy || !stripe}>
        {busy && (
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]" />
        )}
        {busy ? 'Completing…' : `Complete booking · ${money(amount)}`}
      </Button>
      <p className="text-center text-[11px] text-slate-400">
        Secured by Stripe. Your card is authorized now and charged when the hotel confirms.
      </p>
    </div>
  );
}
