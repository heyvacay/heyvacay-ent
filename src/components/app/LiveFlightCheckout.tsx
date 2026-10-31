'use client';

import { useMemo, useRef, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button, Field, Input, Select } from '@/components/app/ui';
import { money } from '@/lib/format';
import {
  flightPaymentIntent,
  buildFlightOrder,
  flightOrder,
  newIdempotencyKey,
  type FlightPassenger,
  type FlightContact,
} from '@/lib/liveBooking';

/**
 * The real flight checkout: collect the passenger + contact, create a Duffel
 * payment intent for the offer, authorize the card with Stripe, then issue the
 * order. Mirrors heyvacay.co's standalone flight flow.
 *
 * Only mounted when live booking is configured. On 501 it calls onFallback so
 * the page records the trip in the workspace instead; an airline-side failure
 * calls onUnavailable (card released, nothing charged).
 */
export function LiveFlightCheckout({
  offerId,
  amount,
  defaultPassenger,
  defaultContact,
  onConfirmed,
  onUnavailable,
  onFallback,
}: {
  offerId: string;
  amount: number;
  defaultPassenger: Partial<FlightPassenger>;
  defaultContact: FlightContact;
  onConfirmed: (bookingRef: string) => void;
  onUnavailable: (message: string) => void;
  onFallback: () => void;
}) {
  type Phase = 'form' | 'starting' | 'pay' | 'processing' | 'error';
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  const [pk, setPk] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const [pax, setPax] = useState<FlightPassenger>({
    title: defaultPassenger.title || 'mr',
    gender: defaultPassenger.gender || 'm',
    givenName: defaultPassenger.givenName || '',
    familyName: defaultPassenger.familyName || '',
    bornOn: defaultPassenger.bornOn || '',
  });
  const [contact, setContact] = useState<FlightContact>({
    email: defaultContact.email || '',
    phone: defaultContact.phone || '',
  });

  const idempotencyKey = useRef(newIdempotencyKey());
  const paymentIntentId = useRef<string | undefined>(undefined);

  const formValid =
    pax.givenName.trim() &&
    pax.familyName.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(pax.bornOn) &&
    /.+@.+\..+/.test(contact.email) &&
    contact.phone.trim().length >= 7;

  const startPayment = async () => {
    setPhase('starting');
    setError('');
    try {
      const cfg = await fetch('/api/payments/config').then((r) => r.json());
      if (!cfg?.liveBooking || !cfg?.publishableKey) {
        onFallback();
        return;
      }
      const intent = await flightPaymentIntent({ outOfferId: offerId });
      if (intent.errorType === 'live_booking_disabled') {
        onFallback();
        return;
      }
      if (!intent.clientSecret || !intent.paymentIntentId) {
        onUnavailable('That fare just expired. Please search again for current prices.');
        return;
      }
      paymentIntentId.current = intent.paymentIntentId;
      setPk(cfg.publishableKey);
      setClientSecret(intent.clientSecret);
      setPhase('pay');
    } catch {
      setError('Could not start payment. Please try again.');
      setPhase('error');
    }
  };

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (pk ? loadStripe(pk) : null),
    [pk]
  );

  const finalize = async (): Promise<void> => {
    setPhase('processing');
    const payload = buildFlightOrder({
      outOfferId: offerId,
      stripePaymentIntentId: paymentIntentId.current,
      idempotencyKey: idempotencyKey.current,
      contact,
      passengers: [pax],
    });
    const res = await flightOrder(payload);
    if (res.errorType || !res.bookingRef) {
      setError(res.message || 'The airline could not issue this ticket. Your card was not charged.');
      setPhase('error');
      return;
    }
    if (res.status && ['failed', 'cancelled'].includes(res.status)) {
      setError('The airline could not confirm this ticket. Your card was not charged.');
      setPhase('error');
      return;
    }
    onConfirmed(res.bookingRef);
  };

  if (phase === 'starting' || phase === 'processing') {
    return (
      <div className="grid place-items-center gap-3 py-8 text-slate-500">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
        <p className="text-sm">
          {phase === 'processing' ? 'Issuing your ticket…' : 'Preparing payment…'}
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
        <Button variant="outline" className="w-full" onClick={() => setPhase('form')}>
          Try again
        </Button>
      </div>
    );
  }

  if (phase === 'pay' && stripePromise && clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#10c3d4' } } }}
      >
        <FlightPayForm amount={amount} clientSecret={clientSecret} onAuthorized={finalize} />
      </Elements>
    );
  }

  // Passenger + contact form.
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-800">Passenger details</p>
      <p className="-mt-1 text-xs text-slate-400">
        Must match the traveler&apos;s government ID exactly.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Title">
          <Select value={pax.title} onChange={(e) => setPax({ ...pax, title: e.target.value })}>
            <option value="mr">Mr</option>
            <option value="ms">Ms</option>
            <option value="mrs">Mrs</option>
            <option value="miss">Miss</option>
            <option value="dr">Dr</option>
          </Select>
        </Field>
        <Field label="Gender">
          <Select value={pax.gender} onChange={(e) => setPax({ ...pax, gender: e.target.value })}>
            <option value="m">Male</option>
            <option value="f">Female</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input value={pax.givenName} onChange={(e) => setPax({ ...pax, givenName: e.target.value })} />
        </Field>
        <Field label="Last name">
          <Input value={pax.familyName} onChange={(e) => setPax({ ...pax, familyName: e.target.value })} />
        </Field>
      </div>
      <Field label="Date of birth">
        <Input type="date" value={pax.bornOn} onChange={(e) => setPax({ ...pax, bornOn: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input
            type="email"
            value={contact.email}
            onChange={(e) => setContact({ ...contact, email: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input
            type="tel"
            value={contact.phone}
            onChange={(e) => setContact({ ...contact, phone: e.target.value })}
            placeholder="+1 555 123 4567"
          />
        </Field>
      </div>
      <Button className="w-full" disabled={!formValid} onClick={startPayment}>
        Continue to payment · {money(amount)}
      </Button>
    </div>
  );
}

function FlightPayForm({
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
        Secured by Stripe. Your card is authorized now and charged when the ticket is issued.
      </p>
    </div>
  );
}
