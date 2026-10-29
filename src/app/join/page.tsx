'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Logo } from '@/components/app/Logo';
import { Button, Field, Input, cn } from '@/components/app/ui';
import { EmailVerify } from '@/components/app/EmailVerify';
import { ArrowRight, Building, Check, Lock, Plane, Sparkles, Users } from '@/components/icons';

type Step = 'email' | 'verify' | 'profile';

const STEPS: { key: Step; label: string; icon: typeof Plane }[] = [
  { key: 'email', label: 'Your email', icon: Building },
  { key: 'verify', label: 'Verify', icon: Lock },
  { key: 'profile', label: 'Your profile', icon: Users },
];

/**
 * Employee sign-up / invite-accept flow. An invited team member lands here
 * (from their invite email), confirms their work email with a code, fills in
 * their profile, and is dropped into their company workspace as a traveler.
 * The company itself is created via /signup (the employer flow).
 */
export default function JoinPage() {
  const { state, setRole, setActiveUser } = useStore();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');

  // Prefill the email from the invite link (?email=...).
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('email');
      if (q) setEmail(q);
    } catch {
      /* ignore */
    }
  }, []);

  const domain = email.includes('@') ? email.split('@')[1]?.trim().toLowerCase() : '';
  const companyDomain = state.company.domain?.toLowerCase();
  const domainMatches = !!domain && !!companyDomain && domain === companyDomain;
  const invited = useMemo(
    () => state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()),
    [state.users, email]
  );

  // If we recognise the invite, prefill their details.
  useEffect(() => {
    if (invited) {
      setName((n) => n || invited.name);
      setTitle((t) => t || invited.title);
      setDepartment((d) => d || invited.department);
    }
  }, [invited]);

  const emailOk = /\S+@\S+\.\S+/.test(email);

  const finish = () => {
    // Drop the new teammate into the workspace as a traveler. (A real backend
    // would create their user from the invite; the demo routes them in.)
    const persona = invited ?? state.users.find((u) => u.role === 'employee') ?? state.users[0];
    if (persona) setActiveUser(persona.id);
    setRole('employee');
    router.push('/app/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[300px_1fr]">
      {/* rail */}
      <aside className="hidden flex-col border-r border-slate-200 bg-white px-6 py-7 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo imgClassName="h-7" />
        </Link>
        <nav className="mt-9 flex-1 space-y-1">
          {STEPS.map((s, i) => {
            const SIcon = s.icon;
            const idx = STEPS.findIndex((x) => x.key === step);
            const done = i < idx;
            const active = i === idx;
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
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Sparkles className="h-4 w-4 text-brand-dark" /> Earn as you travel
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Book in policy and rack up reward points on every trip — all free for your team.
          </p>
        </div>
      </aside>

      {/* content */}
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-10 sm:px-8">
        <div className="mb-6 lg:hidden">
          <Logo imgClassName="h-7" />
        </div>

        {/* STEP: email */}
        {step === 'email' && (
          <section className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
              Join your team
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Accept your invite
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Enter your work email to join your company&apos;s travel program on HeyVacay.
            </p>

            <div className="mt-7">
              <Field label="Work email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoFocus
                />
              </Field>
              {emailOk && (
                <div
                  className={cn(
                    'mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm',
                    domainMatches ? 'bg-brand/10 text-brand-dark' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  <Building className="mt-0.5 h-4 w-4 shrink-0" />
                  {domainMatches ? (
                    <p>
                      <span className="font-semibold">{state.company.name}</span> is on HeyVacay —
                      you&apos;ll be added to their workspace once your email is verified.
                    </p>
                  ) : (
                    <p>
                      We&apos;ll verify your email and match you to your company. If your company
                      isn&apos;t set up yet,{' '}
                      <Link href="/signup" className="font-semibold text-brand-dark hover:underline">
                        set it up here
                      </Link>
                      .
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-9 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <Link href="/signin" className="text-sm font-medium text-slate-400 hover:text-slate-600">
                ← Sign in instead
              </Link>
              <Button onClick={() => setStep('verify')} disabled={!emailOk}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {/* STEP: verify */}
        {step === 'verify' && (
          <section className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
              Confirm it&apos;s you
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Verify your email
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Keeps your company&apos;s workspace secure — only verified work emails can join.
            </p>
            <div className="mt-7">
              <EmailVerify
                email={email}
                company={domainMatches ? state.company.name : undefined}
                onVerified={() => setStep('profile')}
                cta="Verify email"
              />
            </div>
            <div className="mt-9 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <Button variant="ghost" onClick={() => setStep('email')}>
                Back
              </Button>
            </div>
          </section>
        )}

        {/* STEP: profile */}
        {step === 'profile' && (
          <section className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
              Almost there
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Set up your profile
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {invited
                ? `Welcome, ${invited.name.split(' ')[0]} — confirm your details and you're in.`
                : 'Tell us who you are so your bookings and approvals are set up right.'}
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" autoFocus />
              </Field>
              <Field label="Job title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Account Executive" />
              </Field>
              <Field label="Department">
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Sales"
                />
              </Field>
              <Field label="Work email">
                <Input value={email} readOnly />
              </Field>
            </div>

            <div className="mt-9 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <Button variant="ghost" onClick={() => setStep('verify')}>
                Back
              </Button>
              <Button onClick={finish} disabled={!name.trim()}>
                Join {domainMatches ? state.company.name : 'your team'} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
