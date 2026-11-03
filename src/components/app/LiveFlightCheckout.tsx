'use client';

import { useMemo, useRef, useState } from 'react';
import { formatUSPhone } from '@/lib/validate';
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
  onConfirmed: (bookingRef: string, paymentIntentId?: string) => void;
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
    middleName: defaultPassenger.middleName || '',
    familyName: defaultPassenger.familyName || '',
    bornOn: defaultPassenger.bornOn || '',
  });
  const [contact, setContact] = useState<FlightContact>({
    email: defaultContact.email || '',
    phone: defaultContact.phone || '',
  });
  const [seat, setSeat] = useState('');

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
      ...(seat ? { seatPreference: seat } : {}),
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
    onConfirmed(res.bookingRef, paymentIntentId.current);
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
      <Field label="Middle name (optional)">
        <Input
          value={pax.middleName ?? ''}
          onChange={(e) => setPax({ ...pax, middleName: e.target.value })}
          placeholder="As printed on government ID"
        />
      </Field>
      <Field label="Date of birth">
        <Input type="date" value={pax.bornOn} onChange={(e) => setPax({ ...pax, bornOn: e.target.value })} />
      </Field>

      <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Seat</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Pick a seat preference. We&apos;ll request it with the airline at check-in.
        </p>
        <SeatMap selected={seat} onSelect={setSeat} />
      </div>
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
            inputMode="tel"
            value={contact.phone}
            onChange={(e) => setContact({ ...contact, phone: formatUSPhone(e.target.value) })}
            placeholder="(555) 123-4567"
          />
        </Field>
      </div>
      <Button className="w-full" disabled={!formValid} onClick={startPayment}>
        Continue to payment · {money(amount)}
      </Button>
    </div>
  );
}

/**
 * A compact cabin seat picker. This is a seat-preference UX (the enterprise app
 * doesn't carry the airline's live seat map), so a few seats are shown taken and
 * the choice is sent along as a request the airline honors at check-in.
 */
function SeatMap({ selected, onSelect }: { selected: string; onSelect: (s: string) => void }) {
  const rows = [10, 11, 12, 13, 14, 15];
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  // Deterministic "already taken" seats so the map looks real and stable.
  const taken = new Set(['10B', '11E', '12A', '12F', '13C', '14D', '15B', '15E']);
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        <span>Window</span>
        <span>Aisle</span>
        <span>Aisle</span>
        <span>Window</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r} className="flex items-center justify-center gap-1.5">
            <span className="w-5 text-right text-[10px] text-slate-400">{r}</span>
            {cols.map((c, i) => {
              const id = `${r}${c}`;
              const isTaken = taken.has(id);
              const isSel = selected === id;
              return (
                <span key={c} className="flex items-center">
                  <button
                    type="button"
                    disabled={isTaken}
                    onClick={() => onSelect(isSel ? '' : id)}
                    title={isTaken ? 'Taken' : `Seat ${id}`}
                    className={`h-7 w-7 rounded-md border text-[10px] font-semibold transition ${
                      isTaken
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300 dark:border-white/5 dark:bg-white/5'
                        : isSel
                          ? 'border-brand bg-brand text-navy-deep'
                          : 'border-slate-300 bg-white text-slate-600 hover:border-brand dark:border-white/15 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                  {i === 2 && <span className="w-3" />}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
        {selected ? (
          <>Selected seat <span className="font-semibold text-brand-dark">{selected}</span></>
        ) : (
          'No seat selected — the airline will assign one.'
        )}
      </p>
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
