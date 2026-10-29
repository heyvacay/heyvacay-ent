'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, Field, Input, PageHeader, cn } from '@/components/app/ui';
import { Wallet, Globe, Check } from '@/components/icons';

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp: string;
}
interface Passport {
  id: string;
  name: string;
  number: string;
  country: string;
  expiry: string;
}
interface Prefs {
  cards: SavedCard[];
  passports: Passport[];
  emailBooking: boolean;
  emailApprovals: boolean;
  emailTrip: boolean;
  smsTrip: boolean;
  smsUrgent: boolean;
}

const DEFAULT_PREFS: Prefs = {
  cards: [],
  passports: [],
  emailBooking: true,
  emailApprovals: true,
  emailTrip: true,
  smsTrip: false,
  smsUrgent: true,
};

export default function PreferencesPage() {
  const { activeUser, setHomeCity } = useStore();
  const [homeCity, setHomeCityDraft] = useState(activeUser.homeCity ?? '');
  useEffect(() => setHomeCityDraft(activeUser.homeCity ?? ''), [activeUser.homeCity]);
  const key = `hv_prefs_${activeUser.id}`;
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setPrefs(raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS);
    } catch {
      setPrefs(DEFAULT_PREFS);
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs, key, loaded]);

  const [card, setCard] = useState({ brand: 'Visa', last4: '', exp: '' });
  const [pp, setPp] = useState({ name: activeUser.name, number: '', country: '', expiry: '' });

  const addCard = () => {
    if (card.last4.length < 4) return;
    setPrefs((p) => ({
      ...p,
      cards: [...p.cards, { id: crypto.randomUUID(), ...card, last4: card.last4.slice(-4) }],
    }));
    setCard({ brand: 'Visa', last4: '', exp: '' });
  };
  const addPassport = () => {
    if (!pp.number.trim()) return;
    setPrefs((p) => ({ ...p, passports: [...p.passports, { id: crypto.randomUUID(), ...pp }] }));
    setPp({ name: activeUser.name, number: '', country: '', expiry: '' });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="User preferences" subtitle="Your profile, payment, travel documents, and notifications." />

      {/* profile */}
      <Card className="mb-6">
        <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={activeUser.name} readOnly />
          </Field>
          <Field label="Work email">
            <Input value={activeUser.email} readOnly />
          </Field>
          <Field label="Department">
            <Input value={activeUser.department} readOnly />
          </Field>
          <Field label="Title">
            <Input value={activeUser.title} readOnly />
          </Field>
          <Field label="Home city">
            <div className="flex gap-2">
              <Input
                value={homeCity}
                onChange={(e) => setHomeCityDraft(e.target.value)}
                placeholder="e.g. Austin"
              />
              <Button
                variant="outline"
                onClick={() => setHomeCity(activeUser.id, homeCity.trim())}
                disabled={!homeCity.trim() || homeCity.trim() === (activeUser.homeCity ?? '')}
              >
                Save
              </Button>
            </div>
          </Field>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Used for events — whether you&apos;ll need a hotel. Saved to your profile.
        </p>
      </Card>

      {/* payment */}
      <Card className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
          <Wallet className="h-5 w-5 text-brand-dark" /> Saved cards
        </h2>
        {prefs.cards.length > 0 && (
          <div className="mb-4 space-y-2">
            {prefs.cards.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">
                  {c.brand} •••• {c.last4}
                  <span className="ml-2 text-xs font-normal text-slate-400">exp {c.exp || '—'}</span>
                </p>
                <button
                  onClick={() => setPrefs((p) => ({ ...p, cards: p.cards.filter((x) => x.id !== c.id) }))}
                  className="text-xs font-medium text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input value={card.brand} onChange={(e) => setCard({ ...card, brand: e.target.value })} placeholder="Visa" />
          <Input value={card.last4} onChange={(e) => setCard({ ...card, last4: e.target.value.replace(/\D/g, '') })} placeholder="Card number" inputMode="numeric" />
          <Input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} placeholder="MM/YY" />
          <Button onClick={addCard}>Add</Button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Demo only — card details are stored locally in your browser, never sent anywhere.
        </p>
      </Card>

      {/* passports */}
      <Card className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
          <Globe className="h-5 w-5 text-brand-dark" /> Travel documents
        </h2>
        {prefs.passports.length > 0 && (
          <div className="mb-4 space-y-2">
            {prefs.passports.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-400">
                    Passport •••{d.number.slice(-3)} · {d.country || '—'} · exp {d.expiry || '—'}
                  </p>
                </div>
                <button
                  onClick={() => setPrefs((p) => ({ ...p, passports: p.passports.filter((x) => x.id !== d.id) }))}
                  className="text-xs font-medium text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={pp.name} onChange={(e) => setPp({ ...pp, name: e.target.value })} placeholder="Name as on passport" />
          <Input value={pp.number} onChange={(e) => setPp({ ...pp, number: e.target.value })} placeholder="Passport number" />
          <Input value={pp.country} onChange={(e) => setPp({ ...pp, country: e.target.value })} placeholder="Country" />
          <Input value={pp.expiry} onChange={(e) => setPp({ ...pp, expiry: e.target.value })} placeholder="Expiry (MM/YYYY)" />
        </div>
        <div className="mt-3">
          <Button onClick={addPassport}>Add document</Button>
        </div>
      </Card>

      {/* notifications */}
      <Card>
        <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Notifications</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Email</p>
            <Toggle label="Booking confirmations" checked={prefs.emailBooking} onChange={(v) => setPrefs((p) => ({ ...p, emailBooking: v }))} />
            <Toggle label="Approvals & decisions" checked={prefs.emailApprovals} onChange={(v) => setPrefs((p) => ({ ...p, emailApprovals: v }))} />
            <Toggle label="Trip reminders" checked={prefs.emailTrip} onChange={(v) => setPrefs((p) => ({ ...p, emailTrip: v }))} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">SMS</p>
            <Toggle label="Trip-day updates" checked={prefs.smsTrip} onChange={(v) => setPrefs((p) => ({ ...p, smsTrip: v }))} />
            <Toggle label="Urgent (delays, cancellations)" checked={prefs.smsUrgent} onChange={(v) => setPrefs((p) => ({ ...p, smsUrgent: v }))} />
          </div>
        </div>
        <div className="mt-4">
          <Badge color="green">
            <Check className="h-3 w-3" /> Preferences saved automatically
          </Badge>
        </div>
      </Card>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="mb-2 flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-sm text-slate-700">{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-slate-200'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </span>
    </button>
  );
}
