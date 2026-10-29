'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, Field, Input, PageHeader, cn } from '@/components/app/ui';
import { Check, Wallet, Shield } from '@/components/icons';
import type { BillingMode } from '@/lib/types';

const METHODS = ['Credit card', 'Debit card', 'Apple Pay'];

export default function BillingPage() {
  const { state, activeUser, setBillingMode, linkCard, requestNet30, setPersonalCard } = useStore();
  const billing = state.billing ?? { mode: 'employee' as BillingMode };
  const [card, setCard] = useState({ brand: 'Visa', last4: '' });
  const [pcard, setPcard] = useState({ brand: 'Visa', last4: '' });

  const linkedCard = billing.cardLast4;
  const personalCard = activeUser.personalCard;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Billing & payments"
        subtitle="How your company pays for travel booked through HeyVacay."
      />

      {/* accepted methods */}
      <Card className="mb-6">
        <h2 className="mb-2 font-display text-lg font-bold text-slate-900">Accepted payment methods</h2>
        <p className="mb-3 text-sm text-slate-400">
          Available by default for every company. Net 30 terms are set up through a sales rep.
        </p>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              <Check className="h-3.5 w-3.5 text-brand-dark" /> {m}
            </span>
          ))}
        </div>
      </Card>

      {/* how bookings are paid */}
      <Card className="mb-6">
        <h2 className="mb-3 font-display text-lg font-bold text-slate-900">How bookings are paid</h2>
        <div className="space-y-2">
          <Option
            active={billing.mode === 'card'}
            title="Company card on file"
            sub="We save a card for the company and auto-charge it when a booking is made. Employees are never prompted to pay."
            onClick={() => setBillingMode('card')}
          />
          <Option
            active={billing.mode === 'employee'}
            title="Employee enters payment at booking"
            sub="Each traveler is prompted to enter payment when they book."
            onClick={() => setBillingMode('employee')}
          />
          <Option
            active={billing.mode === 'net30'}
            title="Net 30 (invoiced)"
            sub="We invoice the company; travelers are never prompted to pay. Requires sales approval — see below."
            onClick={() => billing.netRequested && setBillingMode('net30')}
            disabled={!billing.netRequested}
          />
        </div>

        {billing.mode === 'card' && (
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Wallet className="h-4 w-4 text-brand-dark" /> Company card
            </p>
            {linkedCard ? (
              <p className="text-sm text-slate-600">
                {billing.cardBrand} •••• {linkedCard} on file.{' '}
                <button
                  onClick={() => linkCard('', '')}
                  className="text-xs font-medium text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input value={card.brand} onChange={(e) => setCard({ ...card, brand: e.target.value })} placeholder="Visa" />
                <Input
                  value={card.last4}
                  onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, '') })}
                  placeholder="Card number"
                  inputMode="numeric"
                />
                <Button onClick={() => card.last4.length >= 4 && linkCard(card.brand, card.last4.slice(-4))}>
                  Link card
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">Demo only — stored locally, never charged.</p>
          </div>
        )}
      </Card>

      {/* personal card */}
      <Card>
        <h2 className="mb-1 font-display text-lg font-bold text-slate-900">Your personal card</h2>
        <p className="mb-3 text-sm text-slate-500">
          Save a personal card to pay for a trip yourself and get reimbursed — it pre-fills at
          checkout and the charge is added to your expenses automatically.
        </p>
        {personalCard ? (
          <p className="text-sm text-slate-600">
            {personalCard.brand} •••• {personalCard.last4} on file.{' '}
            <button
              onClick={() => setPersonalCard(activeUser.id, '', '')}
              className="text-xs font-medium text-slate-400 hover:text-red-600"
            >
              Remove
            </button>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input value={pcard.brand} onChange={(e) => setPcard({ ...pcard, brand: e.target.value })} placeholder="Visa" />
            <Input
              value={pcard.last4}
              onChange={(e) => setPcard({ ...pcard, last4: e.target.value.replace(/\D/g, '') })}
              placeholder="Card number"
              inputMode="numeric"
            />
            <Button
              onClick={() =>
                pcard.last4.length >= 4 &&
                setPersonalCard(activeUser.id, pcard.brand || 'CARD', pcard.last4.slice(-4))
              }
            >
              Save card
            </Button>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">Demo only — stored locally, never charged.</p>
      </Card>

      {/* net 30 */}
      <Card>
        <h2 className="mb-1 font-display text-lg font-bold text-slate-900">How do I start Net 30 payments?</h2>
        {billing.netRequested ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
            <Check className="h-4 w-4" /> Request received — a sales rep will be in touch to set up Net 30.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">
              Net 30 terms are approved by our team. Click below and your account manager will reach out.
            </p>
            <Button onClick={requestNet30}>
              <Shield className="h-4 w-4" /> Request Net 30 — have a rep contact me
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

function Option({
  active,
  title,
  sub,
  onClick,
  disabled,
}: {
  active: boolean;
  title: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
        active ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-slate-300',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border', active ? 'border-brand bg-brand text-navy-deep' : 'border-slate-300')}>
        {active && <Check className="h-3 w-3" />}
      </span>
      <span>
        <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
          {title}
          {disabled && <Badge color="slate">Needs sales approval</Badge>}
        </span>
        <span className="mt-0.5 block text-xs text-slate-400">{sub}</span>
      </span>
    </button>
  );
}
