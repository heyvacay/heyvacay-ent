'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Button, Field, Input } from '@/components/app/ui';
import { money } from '@/lib/format';

/**
 * Checkout payment step. When Stripe is configured it mounts a real Stripe
 * PaymentElement; otherwise it shows a demo card form. Either path calls
 * onPaid() once "payment" succeeds. The DEMO MODE button is always available so
 * the flow is testable end to end without charging anything.
 */
export function StripeCheckout({
  amount,
  description,
  onPaid,
}: {
  amount: number;
  description?: string;
  onPaid: () => void;
}) {
  const [live, setLive] = useState<boolean | null>(null);
  const [pk, setPk] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await fetch('/api/payments/config').then((r) => r.json());
        if (!alive) return;
        if (cfg?.live && cfg.publishableKey) {
          const intent = await fetch('/api/payments/intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, description }),
          }).then((r) => r.json());
          if (!alive) return;
          if (intent?.clientSecret) {
            setPk(cfg.publishableKey);
            setClientSecret(intent.clientSecret);
            setLive(true);
            return;
          }
        }
        setLive(false);
      } catch {
        if (alive) setLive(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [amount, description]);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (pk ? loadStripe(pk) : null),
    [pk]
  );

  if (live === null) {
    return (
      <div className="grid place-items-center py-10 text-slate-400">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
      </div>
    );
  }

  if (live && stripePromise && clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#10c3d4' } } }}
      >
        <RealForm amount={amount} onPaid={onPaid} error={error} setError={setError} />
      </Elements>
    );
  }

  return <DemoForm amount={amount} onPaid={onPaid} />;
}

function RealForm({
  amount,
  onPaid,
  error,
  setError,
}: {
  amount: number;
  onPaid: () => void;
  error: string;
  setError: (s: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    const { error: err } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    setBusy(false);
    if (err) {
      setError(err.message || 'Payment could not be completed.');
      return;
    }
    onPaid();
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      <Button className="w-full" onClick={pay} disabled={busy || !stripe}>
        {busy ? 'Processing…' : `Pay ${money(amount)}`}
      </Button>
      <p className="text-center text-[11px] text-slate-400">
        Secured by Stripe. Your card details never touch our servers.
      </p>
    </div>
  );
}

function DemoForm({ amount, onPaid }: { amount: number; onPaid: () => void }) {
  const [cc, setCc] = useState({ name: '', num: '', exp: '', cvc: '' });
  return (
    <div className="space-y-4">
      <Field label="Name on card">
        <Input value={cc.name} onChange={(e) => setCc({ ...cc, name: e.target.value })} placeholder="Full name" />
      </Field>
      <Field label="Card number">
        <Input
          value={cc.num}
          onChange={(e) => setCc({ ...cc, num: e.target.value })}
          placeholder="1234 5678 9012 3456"
          inputMode="numeric"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Expiry">
          <Input value={cc.exp} onChange={(e) => setCc({ ...cc, exp: e.target.value })} placeholder="MM/YY" />
        </Field>
        <Field label="CVC">
          <Input value={cc.cvc} onChange={(e) => setCc({ ...cc, cvc: e.target.value })} placeholder="123" inputMode="numeric" />
        </Field>
      </div>
      <Button className="w-full" onClick={onPaid}>
        Pay {money(amount)}
      </Button>
      <button
        onClick={onPaid}
        className="w-full rounded-lg border border-dashed border-amber-300 bg-amber-50 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100"
      >
        DEMO MODE — DOES NOT CREATE A REAL BOOKING
      </button>
      <p className="text-center text-[11px] text-slate-400">
        Stripe isn&apos;t configured yet, so this is a simulated payment.
      </p>
    </div>
  );
}
