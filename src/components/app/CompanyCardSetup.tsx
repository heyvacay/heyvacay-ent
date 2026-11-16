'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useStore } from '@/lib/store';
import { Button, Input } from '@/components/app/ui';
import { Wallet } from '@/components/icons';

/**
 * Save a real company card with Stripe (a SetupIntent, usage=off_session) so
 * bookings can be auto-charged to it later without prompting the traveler. When
 * Stripe's secret key isn't configured, it falls back to the demo card form
 * (stored locally, never charged) so the flow is testable end to end.
 */
export function CompanyCardSetup() {
  const { state, activeUser, linkCard, setCompanyCard } = useStore();
  const companyId = state.company.id;
  const existingCustomer = state.billing?.companyCard?.customerId;

  const [phase, setPhase] = useState<'loading' | 'real' | 'demo'>('loading');
  const [pk, setPk] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/billing/setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            companyName: state.company.name,
            email: activeUser.email,
            customerId: existingCustomer,
          }),
        });
        const data = await res.json();
        if (!alive) return;
        if (res.ok && data.configured && data.clientSecret && data.publishableKey) {
          setPk(data.publishableKey);
          setClientSecret(data.clientSecret);
          setCustomerId(data.customerId);
          setPhase('real');
        } else {
          setPhase('demo');
        }
      } catch {
        if (alive) setPhase('demo');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (pk ? loadStripe(pk) : null),
    [pk],
  );

  if (phase === 'loading') {
    return (
      <div className="grid place-items-center py-6 text-slate-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
      </div>
    );
  }

  if (phase === 'real' && stripePromise && clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#10c3d4' } } }}
      >
        <SaveCardForm
          customerId={customerId}
          onSaved={(card) => setCompanyCard(card)}
          error={error}
          setError={setError}
        />
      </Elements>
    );
  }

  // Demo fallback — stores last4 locally, never charged.
  return <DemoCardForm onLink={(brand, last4) => linkCard(brand, last4)} />;
}

function SaveCardForm({
  customerId,
  onSaved,
  error,
  setError,
}: {
  customerId: string;
  onSaved: (card: {
    customerId: string;
    paymentMethodId: string;
    brand: string;
    last4: string;
    expMonth?: number;
    expYear?: number;
    savedAt: string;
  }) => void;
  error: string;
  setError: (s: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError('');
    const { error: err, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (err || !setupIntent) {
      setBusy(false);
      setError(err?.message || 'Could not save the card. Please try again.');
      return;
    }
    try {
      const res = await fetch('/api/billing/save-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupIntentId: setupIntent.id, customerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.card) {
        setError(data.error || 'Could not save the card.');
        return;
      }
      onSaved(data.card);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      <Button className="w-full" onClick={save} disabled={busy || !stripe}>
        <Wallet className="h-4 w-4" /> {busy ? 'Saving…' : 'Save company card'}
      </Button>
      <p className="text-center text-[11px] text-slate-400">
        Secured by Stripe. We store a token, never the full card number. Charged automatically when a
        booking is made on the company card.
      </p>
    </div>
  );
}

function DemoCardForm({ onLink }: { onLink: (brand: string, last4: string) => void }) {
  const [card, setCard] = useState({ brand: 'Visa', last4: '' });
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <Input value={card.brand} onChange={(e) => setCard({ ...card, brand: e.target.value })} placeholder="Visa" />
      <Input
        value={card.last4}
        onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, '') })}
        placeholder="Card number"
        inputMode="numeric"
      />
      <Button onClick={() => card.last4.length >= 4 && onLink(card.brand, card.last4.slice(-4))}>
        Link card
      </Button>
    </div>
  );
}
