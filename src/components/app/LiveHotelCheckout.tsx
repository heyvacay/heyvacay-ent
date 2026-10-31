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
  onConfirmed: (bookingRef: string) => void;
  onUnavailable: (message: string) => void;
  onFallback: () => void;
}) {
  type Phase = 'prep' | 'pay' | 'processing' | 'error';
  const [phase, setPhase] = useState<Phase>('prep');
  const [prepMsg, setPrepMsg] = useState('Locking in your room…');
  const [error, setError] = useState('');
  const [pk, setPk] = useState('');
  const [clientSecret, setClientSecret] = useState('');
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
        // Need the publishable key to mount Stripe at all.
        const cfg = await fetch('/api/payments/config').then((r) => r.json());
        if (!cfg?.liveBooking) {
          onFallback();
          return;
        }
        if (!cfg?.publishableKey) {
          onFallback();
          return;
        }

        setPrepMsg('Locking in your room…');
        const pre = await prebook(
          buildPrebookPayload({ hid, detail, rate, checkin, checkout, adults })
        );
        if (pre.errorType === 'live_booking_disabled') {
          onFallback();
          return;
        }
        if (!pre.bookingRef) {
          onUnavailable(
            pre.errorType === 'price_changed'
              ? 'The room price just changed. Please re-select the room to see the new total.'
              : pre.errorType === 'no_longer_available'
                ? 'That rate just sold out. Please pick another room.'
                : pre.message || 'We could not lock in that room. Please try another.'
          );
          return;
        }
        if (pre.priceChanged) {
          onUnavailable('The room price just changed. Please re-select the room to see the new total.');
          return;
        }

        setPrepMsg('Preparing payment…');
        await bookingForm(pre.bookingRef); // surfaces payment types; backend also sets the order up

        const init = await paymentInit({
          bookingRef: pre.bookingRef,
          amount,
          currency: rate.currency || 'USD',
        });
        if (!init.clientSecret) {
          setError('Payment could not be initialized. Please try again.');
          setPhase('error');
          return;
        }

        session.current = {
          bookingRef: pre.bookingRef,
          payUuid: init.payUuid,
          initUuid: init.initUuid,
          orderId: init.orderId,
        };
        setPk(cfg.publishableKey);
        setClientSecret(init.clientSecret);
        setPhase('pay');
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
      amount,
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
      onConfirmed(ref);
      return;
    }
    if (res.status && ['failed', 'error', 'cancelled'].includes(res.status)) {
      setError('The supplier could not confirm this stay. Your card was not charged.');
      setPhase('error');
      return;
    }
    // Poll until the supplier confirms.
    const poll = await pollStatus(ref);
    if (poll.ok) {
      onConfirmed(ref);
      return;
    }
    if (poll.failed) {
      setError('The supplier could not confirm this stay. Your card was not charged.');
      setPhase('error');
      return;
    }
    // Pending past our window — treat as "under review" and let the trip record
    // with the ref; it will reconcile server-side.
    onConfirmed(ref);
  };

  if (phase === 'prep' || phase === 'processing') {
    return (
      <div className="grid place-items-center gap-3 py-10 text-slate-500">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
        <p className="text-sm">
          {phase === 'processing' ? 'Confirming your stay with the hotel…' : prepMsg}
        </p>
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

  if (stripePromise && clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: { theme: 'stripe', variables: { colorPrimary: '#10c3d4' } },
        }}
      >
        <LivePayForm amount={amount} clientSecret={clientSecret} onAuthorized={finalize} />
      </Elements>
    );
  }

  return null;
}

function LivePayForm({
  amount,
  clientSecret,
  onAuthorized,
}: {
  amount: number;
  clientSecret: string;
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
    const submit = await elements.submit();
    if (submit.error) {
      setError(submit.error.message || 'Please check your card details.');
      setBusy(false);
      return;
    }
    const { error: err } = await stripe.confirmPayment({
      elements,
      clientSecret,
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
      <PaymentElement />
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      <Button className="w-full" onClick={pay} disabled={busy || !stripe}>
        {busy ? 'Processing…' : `Pay ${money(amount)}`}
      </Button>
      <p className="text-center text-[11px] text-slate-400">
        Secured by Stripe. Your card is authorized now and charged when the hotel confirms.
      </p>
    </div>
  );
}
