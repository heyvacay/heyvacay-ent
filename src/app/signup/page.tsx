'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Button, Field, Input, Select, cn } from '@/components/app/ui';
import { money, num, todayISO } from '@/lib/format';
import type { Integration, OnboardingProfile } from '@/lib/types';
import {
  ArrowRight,
  Building,
  Check,
  Gift,
  Globe,
  Lock,
  Plane,
  Receipt,
  Shield,
  Sparkles,
  Users,
  Wallet,
} from '@/components/icons';

type Form = {
  companyName: string;
  workEmail: string;
  teamSize: string;
  hq: string;
  currency: string;
  tripsPerMonth: string;
  books: 'flights' | 'hotels' | 'both';
  geography: 'domestic' | 'international' | 'mixed';
  annualSpend: number;
  bookingTool: string;
  expenseTool: string;
  maxStar: number;
  nightlyCap: number;
  cabin: string;
  advanceDays: number;
  integrations: string[];
  invites: string[];
};

const INITIAL: Form = {
  companyName: '',
  workEmail: '',
  teamSize: '11–50',
  hq: '',
  currency: 'USD',
  tripsPerMonth: '10–50',
  books: 'both',
  geography: 'mixed',
  annualSpend: 500000,
  bookingTool: 'Nothing formal yet',
  expenseTool: 'Spreadsheets',
  maxStar: 4,
  nightlyCap: 300,
  cabin: 'Economy',
  advanceDays: 7,
  integrations: ['quickbooks', 'bamboohr'],
  invites: ['', '', ''],
};

const STEPS = [
  { key: 'company', label: 'Company', icon: Building },
  { key: 'travel', label: 'How you travel', icon: Plane },
  { key: 'spend', label: 'Spend & tools', icon: Wallet },
  { key: 'policies', label: 'Guardrails', icon: Shield },
  { key: 'integrations', label: 'Connect tools', icon: Globe },
  { key: 'invite', label: 'Invite team', icon: Users },
  { key: 'summary', label: 'Your savings', icon: Sparkles },
] as const;

const SPEND_PRESETS = [100000, 500000, 1000000, 5000000];

/* ---------- small building blocks ---------- */

function OptionCard({
  selected,
  onClick,
  title,
  sub,
  icon: Icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
  icon?: typeof Plane;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
        selected
          ? 'border-brand bg-brand/8 ring-1 ring-brand/40'
          : 'border-slate-200 bg-white hover:border-slate-300'
      )}
    >
      {Icon && (
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
            selected ? 'bg-brand/15 text-brand-dark' : 'bg-slate-100 text-slate-500'
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        {sub && <span className="mt-0.5 block text-xs text-slate-400">{sub}</span>}
      </span>
      {selected && (
        <span className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-navy-deep">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

function StepShell({
  eyebrow,
  title,
  blurb,
  children,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
        {eyebrow}
      </p>
      <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-slate-500">{blurb}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

/* ---------- the flow ---------- */

export default function SignupPage() {
  const { completeOnboarding, setRole, setActiveUser } = useStore();
  const router = useRouter();

  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(INITIAL);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const estimate = useMemo(
    () => Math.round(form.annualSpend * 0.15),
    [form.annualSpend]
  );

  const canContinue = () => {
    if (STEPS[step].key === 'company')
      return form.companyName.trim().length > 1 && /\S+@\S+\.\S+/.test(form.workEmail);
    return true;
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = () => {
    const profile: OnboardingProfile = {
      companyName: form.companyName.trim(),
      workEmail: form.workEmail.trim(),
      teamSize: form.teamSize,
      hq: form.hq.trim(),
      currency: form.currency,
      tripsPerMonth: form.tripsPerMonth,
      books: form.books,
      geography: form.geography,
      annualSpend: form.annualSpend,
      bookingTool: form.bookingTool,
      expenseTool: form.expenseTool,
      integrations: form.integrations,
      invites: form.invites.map((e) => e.trim()).filter(Boolean),
      estimatedSavings: estimate,
      completedAt: todayISO(),
    };
    completeOnboarding(profile);
    setActiveUser('u_admin');
    setRole('admin');
    router.push('/app/dashboard');
  };

  /* ----- welcome gate ----- */
  if (!started) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
        <div className="w-full max-w-lg text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/15 ring-1 ring-brand/30">
            <Sparkles className="h-6 w-6 text-brand-dark" />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-dark">
            HeyVacay Enterprise
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Let&apos;s build your travel &amp; expense program
          </h1>
          <p className="mx-auto mt-3 max-w-md text-slate-500">
            A few quick questions so we can route your team to below-market fares,
            automate expensing, and show you exactly what you&apos;ll save. Takes
            about two minutes.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-brand-dark" /> 100% free for companies
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-brand-dark" /> No credit card
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-brand-dark" /> Your data stays yours
            </span>
          </div>
          <Button className="mt-8" onClick={() => setStarted(true)}>
            Get started <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="mt-4 text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/app" className="font-semibold text-brand-dark hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const Icon = STEPS[step].icon;
  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[300px_1fr]">
      {/* rail */}
      <aside className="hidden flex-col border-r border-slate-200 bg-white px-6 py-7 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
            <Sparkles className="h-4 w-4 text-brand-dark" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm font-bold text-slate-900">
              HeyVacay
            </span>
            <span className="block text-[11px] font-semibold text-brand-dark">
              Enterprise
            </span>
          </span>
        </Link>

        <nav className="mt-9 flex-1 space-y-1">
          {STEPS.map((s, i) => {
            const SIcon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div
                key={s.key}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                  active ? 'bg-brand/10 font-semibold text-slate-900' : 'text-slate-500'
                )}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs',
                    done
                      ? 'bg-brand text-navy-deep'
                      : active
                        ? 'bg-brand/20 text-brand-dark ring-1 ring-brand/40'
                        : 'bg-slate-100 text-slate-400'
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <SIcon className="h-3.5 w-3.5" />}
                </span>
                {s.label}
              </div>
            );
          })}
        </nav>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Free, forever</p>
          <p className="mt-1 text-xs text-slate-400">
            Companies never pay. We earn a small commission on each booking — only
            when you save.
          </p>
        </div>
      </aside>

      {/* content */}
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-7 sm:px-8">
        {/* progress */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-brand-dark">
              <Icon className="h-4 w-4" /> Step {step + 1} of {STEPS.length}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex-1">
          {/* STEP: company */}
          {STEPS[step].key === 'company' && (
            <StepShell
              eyebrow="About your company"
              title="Tell us who we're setting up"
              blurb="We use this to personalize your program and set your default currency."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company name">
                  <Input
                    value={form.companyName}
                    onChange={(e) => set('companyName', e.target.value)}
                    placeholder="Northwind Robotics"
                    autoFocus
                  />
                </Field>
                <Field label="Your work email">
                  <Input
                    type="email"
                    value={form.workEmail}
                    onChange={(e) => set('workEmail', e.target.value)}
                    placeholder="you@company.com"
                  />
                </Field>
                <Field label="Team size">
                  <Select
                    value={form.teamSize}
                    onChange={(e) => set('teamSize', e.target.value)}
                  >
                    {['1–10', '11–50', '51–200', '201–1,000', '1,000+'].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Headquarters" hint="City, country — optional">
                  <Input
                    value={form.hq}
                    onChange={(e) => set('hq', e.target.value)}
                    placeholder="San Francisco, USA"
                  />
                </Field>
                <Field label="Currency">
                  <Select
                    value={form.currency}
                    onChange={(e) => set('currency', e.target.value)}
                  >
                    {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </StepShell>
          )}

          {/* STEP: travel */}
          {STEPS[step].key === 'travel' && (
            <StepShell
              eyebrow="How your team travels"
              title="Help us find your savings"
              blurb="The more we know about how you travel, the better we route you to below-market fares — that's where the savings come from."
            >
              <p className="mb-2 text-sm font-medium text-slate-700">
                How many trips does your team take a month?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {['Under 10', '10–50', '50–200', '200+'].map((t) => (
                  <OptionCard
                    key={t}
                    title={t}
                    selected={form.tripsPerMonth === t}
                    onClick={() => set('tripsPerMonth', t)}
                  />
                ))}
              </div>

              <p className="mb-2 mt-6 text-sm font-medium text-slate-700">
                What do you book most?
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['flights', 'Flights', Plane],
                    ['hotels', 'Hotels', Receipt],
                    ['both', 'Both', Globe],
                  ] as const
                ).map(([v, label, Ic]) => (
                  <OptionCard
                    key={v}
                    title={label}
                    icon={Ic}
                    selected={form.books === v}
                    onClick={() => set('books', v)}
                  />
                ))}
              </div>

              <p className="mb-2 mt-6 text-sm font-medium text-slate-700">
                Where does your team travel?
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['domestic', 'Mostly domestic'],
                    ['international', 'Mostly international'],
                    ['mixed', 'A mix of both'],
                  ] as const
                ).map(([v, label]) => (
                  <OptionCard
                    key={v}
                    title={label}
                    selected={form.geography === v}
                    onClick={() => set('geography', v)}
                  />
                ))}
              </div>
            </StepShell>
          )}

          {/* STEP: spend & tools */}
          {STEPS[step].key === 'spend' && (
            <StepShell
              eyebrow="Spend & current tools"
              title="Where are the dollars going today?"
              blurb="This is where we find the leaks — and where connecting your accounting and HR makes expensing automatic."
            >
              <Field label="Estimated annual travel spend">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">
                    {form.currency === 'USD' ? '$' : ''}
                  </span>
                  <Input
                    type="number"
                    value={form.annualSpend}
                    onChange={(e) => set('annualSpend', Number(e.target.value) || 0)}
                  />
                </div>
              </Field>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPEND_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('annualSpend', v)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      form.annualSpend === v
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                    )}
                  >
                    {money(v)}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="How do you book travel today?">
                  <Select
                    value={form.bookingTool}
                    onChange={(e) => set('bookingTool', e.target.value)}
                  >
                    {[
                      'Nothing formal yet',
                      'Direct with airlines/hotels',
                      'Concur',
                      'Navan (TripActions)',
                      'TravelPerk',
                      'Other',
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="How do you expense today?">
                  <Select
                    value={form.expenseTool}
                    onChange={(e) => set('expenseTool', e.target.value)}
                  >
                    {[
                      'Spreadsheets',
                      'Expensify',
                      'Ramp',
                      'Brex',
                      'QuickBooks',
                      'Nothing formal yet',
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="mt-5 flex items-start gap-2 rounded-xl bg-brand/8 px-4 py-3 text-sm text-slate-600">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
                At {money(form.annualSpend)} a year, companies like yours typically
                save around{' '}
                <span className="font-semibold text-slate-800">
                  {money(estimate)}
                </span>{' '}
                with HeyVacay.
              </div>
            </StepShell>
          )}

          {/* STEP: policies */}
          {STEPS[step].key === 'policies' && (
            <StepShell
              eyebrow="Guardrails"
              title="Set your travel policy"
              blurb="We've pre-filled sensible defaults. These keep spend in line automatically — you can change any of them later."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Max hotel stars">
                  <Select
                    value={String(form.maxStar)}
                    onChange={(e) => set('maxStar', Number(e.target.value))}
                  >
                    {[3, 4, 5].map((s) => (
                      <option key={s} value={s}>
                        {s} stars
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nightly hotel cap">
                  <Input
                    type="number"
                    value={form.nightlyCap}
                    onChange={(e) => set('nightlyCap', Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Default flight cabin">
                  <Select
                    value={form.cabin}
                    onChange={(e) => set('cabin', e.target.value)}
                  >
                    {['Economy', 'Premium economy', 'Business'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Book at least N days ahead">
                  <Input
                    type="number"
                    value={form.advanceDays}
                    onChange={(e) => set('advanceDays', Number(e.target.value) || 0)}
                  />
                </Field>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Out-of-policy trips route to an approver automatically — no chasing,
                no spreadsheets.
              </p>
            </StepShell>
          )}

          {/* STEP: integrations */}
          {STEPS[step].key === 'integrations' && (
            <StepShell
              eyebrow="Connect your tools"
              title="Make expensing automatic"
              blurb="Sync your accounting and HR so expenses post to the right codes and your roster stays current — the easiest expensing in the world. Pick what you use; we'll set these up with you."
            >
              <IntegrationPicker
                selected={form.integrations}
                onToggle={(id) =>
                  set(
                    'integrations',
                    form.integrations.includes(id)
                      ? form.integrations.filter((x) => x !== id)
                      : [...form.integrations, id]
                  )
                }
              />
            </StepShell>
          )}

          {/* STEP: invite */}
          {STEPS[step].key === 'invite' && (
            <StepShell
              eyebrow="Invite your team"
              title="Bring a few teammates (optional)"
              blurb="Add the people who book or travel most. You can invite everyone else later, or sync your whole roster from HR."
            >
              <div className="space-y-3">
                {form.invites.map((email, i) => (
                  <Input
                    key={i}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const copy = [...form.invites];
                      copy[i] = e.target.value;
                      set('invites', copy);
                    }}
                    placeholder={`teammate${i + 1}@company.com`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => set('invites', [...form.invites, ''])}
                  className="text-sm font-semibold text-brand-dark hover:underline"
                >
                  + Add another
                </button>
              </div>
            </StepShell>
          )}

          {/* STEP: summary */}
          {STEPS[step].key === 'summary' && (
            <StepShell
              eyebrow="Your program is ready"
              title={`Here's what ${form.companyName || 'your company'} will save`}
              blurb="Based on what you told us. Everything below is live the moment you enter your dashboard."
            >
              <div className="rounded-2xl border border-brand/30 bg-brand/8 p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
                  Estimated annual savings
                </p>
                <p className="mt-1 font-display text-5xl font-extrabold text-brand-dark">
                  {money(estimate)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  ~15% below market on {money(form.annualSpend)} of travel — plus{' '}
                  {num(Math.round(estimate * 1.5))} reward points for your team.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ['Company', form.companyName || '—'],
                  ['Team size', form.teamSize],
                  ['Trips / month', form.tripsPerMonth],
                  ['Annual travel spend', money(form.annualSpend)],
                  ['Hotel policy', `Up to ${form.maxStar}★ · ${money(form.nightlyCap)}/night`],
                  [
                    'Integrations',
                    form.integrations.length
                      ? `${form.integrations.length} selected`
                      : 'None yet',
                  ],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <span className="text-slate-400">{k}</span>
                    <span className="font-medium text-slate-800">{v}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <Gift className="h-4 w-4 shrink-0 text-brand-dark" />
                $0 setup, $0 subscription. You only ever pay suppliers — we take a
                small commission from them, never a fee from you.
              </div>
            </StepShell>
          )}
        </div>

        {/* nav */}
        <div className="mt-9 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
          {step > 0 ? (
            <Button variant="ghost" onClick={back}>
              Back
            </Button>
          ) : (
            <Link
              href="/"
              className="text-sm font-medium text-slate-400 hover:text-slate-600"
            >
              ← Home
            </Link>
          )}

          {STEPS[step].key === 'summary' ? (
            <Button onClick={finish}>
              Enter your dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={next} disabled={!canContinue()}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

/* ---------- integration picker (grouped) ---------- */

function IntegrationPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { state } = useStore();
  const integrations = state.integrations;
  const cats = useMemo(() => {
    const map = new Map<string, Integration[]>();
    for (const it of integrations) {
      const arr = map.get(it.category) ?? [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return Array.from(map.entries());
  }, [integrations]);

  return (
    <div className="space-y-6">
      {cats.map(([cat, items]) => (
        <div key={cat}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {cat}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <OptionCard
                key={it.id}
                title={it.name}
                sub={it.blurb}
                selected={selected.includes(it.id)}
                onClick={() => onToggle(it.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
