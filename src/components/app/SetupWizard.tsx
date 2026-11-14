'use client';

import { useMemo, useState } from 'react';
import { Logo } from './Logo';
import { CelebrationOverlay } from './CelebrationOverlay';
import { Button, Field, Input, cn } from './ui';
import { useStore } from '@/lib/store';
import { sendEmail } from '@/lib/email';
import type { SignInMethod } from '@/lib/types';
import {
  Sparkles,
  Shield,
  Users,
  Globe,
  Lock,
  Building,
  Check,
  ArrowRight,
} from '@/components/icons';

/**
 * Self-guided account setup — the branching, "ask-me-questions" onboarding an
 * account admin completes on first access. It captures how employees sign in
 * (SSO / domain self-join / manual / from an integration), the default approval
 * rule, the company's departments, and an optional first wave of invites — then
 * marks the account set up. Clean, step-by-step, and celebratory at the end.
 *
 * Gated in AppShell: shown only to an account admin, not while a rep is
 * viewing-as, when company.setup.required && !completedAt.
 */

type StepKey = 'intro' | 'signin' | 'approval' | 'departments' | 'invite' | 'review';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'intro', label: 'Welcome' },
  { key: 'signin', label: 'How your team joins' },
  { key: 'approval', label: 'Approvals' },
  { key: 'departments', label: 'Departments' },
  { key: 'invite', label: 'Invite admins' },
  { key: 'review', label: 'Review' },
];

const SIGN_IN_OPTIONS: {
  key: SignInMethod;
  title: string;
  blurb: string;
  icon: typeof Globe;
}[] = [
  {
    key: 'sso',
    title: 'Single sign-on (SSO)',
    blurb: 'Your team signs in with Okta, Google, Entra or any SAML provider. Most secure for larger teams.',
    icon: Lock,
  },
  {
    key: 'domain_join',
    title: 'Domain self-join',
    blurb: 'Anyone with a company email address can join themselves — no invite needed. Fastest to roll out.',
    icon: Globe,
  },
  {
    key: 'manual',
    title: 'Add people manually',
    blurb: 'You invite each teammate by email from the People page. Best for tight control over who has access.',
    icon: Users,
  },
  {
    key: 'integration',
    title: 'Sync from an integration',
    blurb: 'Pull your roster automatically from your HR system, so people and departments stay in sync.',
    icon: Building,
  },
];

const ROSTER_INTEGRATIONS = [
  { key: 'bamboohr', label: 'BambooHR' },
  { key: 'workday', label: 'Workday' },
  { key: 'ukg', label: 'UKG Pro' },
  { key: 'gusto', label: 'Gusto' },
  { key: 'google', label: 'Google Workspace' },
  { key: 'rippling', label: 'Rippling' },
  { key: 'okta', label: 'Okta' },
];

const INTRO_CARDS: { Icon: typeof Globe; title: string; desc: string }[] = [
  { Icon: Globe, title: 'How your team joins', desc: 'SSO, self-join, manual, or synced from your HR system' },
  { Icon: Shield, title: 'Your travel rules', desc: 'Set whether trips need approval before booking' },
  { Icon: Building, title: 'Departments', desc: 'So you can hand rules to department heads' },
  { Icon: Users, title: 'Your admins', desc: 'Invite anyone else who should help run the account' },
];

export function SetupWizard({ onDone }: { onDone: () => void }) {
  const { state, activeUser, setCompanySetup, completeSetup, inviteUser } = useStore();
  const company = state.company;
  const firstName = (activeUser.name ?? 'there').trim().split(' ')[0] || 'there';
  const setup = company.setup ?? {};

  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);

  // --- answers (seeded from any saved partial progress) ---
  const [signIn, setSignIn] = useState<SignInMethod | undefined>(setup.signInMethod);
  const defaultDomain = (company.domain || '').replace(/^@/, '');
  const [domains, setDomains] = useState<string[]>(
    setup.domainSelfJoin?.domains?.length
      ? setup.domainSelfJoin.domains
      : defaultDomain
        ? [defaultDomain]
        : []
  );
  const [domainInput, setDomainInput] = useState('');
  const [rosterIntegration, setRosterIntegration] = useState<string | undefined>(
    setup.rosterIntegration
  );
  const [requireApproval, setRequireApproval] = useState<boolean>(
    setup.requireApproval ?? true
  );
  const [departments, setDepartments] = useState<string[]>(
    setup.departments?.length ? setup.departments : ['Engineering', 'Sales', 'Operations']
  );
  const [deptInput, setDeptInput] = useState('');
  const [invites, setInvites] = useState<{ name: string; email: string }[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const step = STEPS[stepIdx];

  const canContinue = useMemo(() => {
    if (step.key === 'signin') {
      if (!signIn) return false;
      if (signIn === 'domain_join') return domains.length > 0;
      if (signIn === 'integration') return !!rosterIntegration;
    }
    return true;
  }, [step.key, signIn, domains.length, rosterIntegration]);

  const addDomain = () => {
    const d = domainInput.trim().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (d && !domains.includes(d)) setDomains((cur) => [...cur, d]);
    setDomainInput('');
  };
  const addDept = () => {
    const d = deptInput.trim();
    if (d && !departments.includes(d)) setDepartments((cur) => [...cur, d]);
    setDeptInput('');
  };
  const addInvite = () => {
    const email = inviteEmail.trim();
    if (!email || !email.includes('@')) return;
    setInvites((cur) => [...cur, { name: inviteName.trim() || email.split('@')[0], email }]);
    setInviteName('');
    setInviteEmail('');
  };

  // Persist the current step's answers into the company setup config as we go,
  // then advance (or finish).
  const persistStep = () => {
    if (step.key === 'signin') {
      setCompanySetup({
        signInMethod: signIn,
        domainSelfJoin: { enabled: signIn === 'domain_join', domains },
        rosterIntegration: signIn === 'integration' ? rosterIntegration : undefined,
      });
    } else if (step.key === 'approval') {
      setCompanySetup({ requireApproval });
    } else if (step.key === 'departments') {
      setCompanySetup({ departments });
    }
  };

  const next = () => {
    persistStep();
    if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
  };
  const back = () => setStepIdx((i) => Math.max(0, i - 1));

  const finish = () => {
    // Fire any admin invites the owner added.
    for (const inv of invites) {
      try {
        inviteUser({
          name: inv.name,
          email: inv.email,
          department: departments[0] ?? 'Unassigned',
          title: 'Admin',
          role: 'admin',
        });
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        void sendEmail('invite', inv.email, {
          name: inv.name,
          company: company.name,
          inviter: activeUser.name,
          role: 'Admin',
          joinUrl: `${origin}/join?email=${encodeURIComponent(inv.email)}`,
        });
      } catch {
        /* non-fatal */
      }
    }
    completeSetup(activeUser.name);
    setDone(true);
  };

  if (done) {
    return (
      <CelebrationOverlay
        headline={
          <>
            {company.name} is ready to
            <br />
            <span className="text-brand">travel smart.</span>
          </>
        }
        sub={`Nice work, ${firstName}! Your account is set up — your team can get in, every trip stays in policy, and the savings start now.`}
        cta="Go to my dashboard →"
        onCta={onDone}
        footnote="You can change any of this later from Setup."
      />
    );
  }

  const pct = Math.round((stepIdx / (STEPS.length - 1)) * 100);

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-navy-deep/97 px-4 py-6 sm:py-10">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 sm:flex-row">
        {/* left rail */}
        <aside className="shrink-0 bg-gradient-to-br from-navy via-surface to-brand-dark p-6 text-white sm:w-72 sm:p-8">
          <Logo imgClassName="h-7" />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Account setup
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold leading-tight">
            Let&apos;s get {company.name} live.
          </h2>
          <ol className="mt-6 space-y-1">
            {STEPS.map((s, i) => {
              const active = i === stepIdx;
              const complete = i < stepIdx;
              return (
                <li key={s.key} className="flex items-center gap-3 py-1.5">
                  <span
                    className={cn(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                      active
                        ? 'bg-brand text-navy-deep'
                        : complete
                          ? 'bg-emerald-400 text-navy-deep'
                          : 'bg-white/15 text-white/70'
                    )}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn('text-sm', active ? 'font-semibold text-white' : 'text-white/60')}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
        </aside>

        {/* right content */}
        <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-10">
          <div className="flex-1">
            {step.key === 'intro' && (
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-dark">
                  <Sparkles className="h-3.5 w-3.5" /> Takes about 2 minutes
                </span>
                <h1 className="mt-4 font-display text-3xl font-bold text-slate-900 dark:text-white">
                  Welcome, {firstName} 👋
                </h1>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-slate-500 dark:text-slate-300">
                  You&apos;re the admin for <span className="font-semibold text-slate-700 dark:text-slate-100">{company.name}</span>.
                  We&apos;ll ask a few quick questions and set everything up for you — how your
                  team signs in, your approval rule, your departments, and your first admins.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {INTRO_CARDS.map(({ Icon, title, desc }, i) => (
                    <div key={i} className="flex gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-dark" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step.key === 'signin' && (
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  How should your team sign in?
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Pick how people get into {company.name}. You can combine methods later — this sets your default.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {SIGN_IN_OPTIONS.map((o) => {
                    const active = signIn === o.key;
                    const Icon = o.icon;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setSignIn(o.key)}
                        className={cn(
                          'flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition',
                          active
                            ? 'border-brand bg-brand/8 ring-1 ring-brand/40'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                        )}
                      >
                        <span className={cn('grid h-9 w-9 place-items-center rounded-xl', active ? 'bg-brand/20 text-brand-dark' : 'bg-slate-100 text-slate-500 dark:bg-slate-800')}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {o.title}
                          {active && <Check className="h-4 w-4 text-brand-dark" />}
                        </span>
                        <span className="text-xs leading-relaxed text-slate-500">{o.blurb}</span>
                      </button>
                    );
                  })}
                </div>

                {/* branch: domain self-join */}
                {signIn === 'domain_join' && (
                  <div className="mt-5 rounded-2xl border border-brand/30 bg-brand/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <Globe className="h-4 w-4 text-brand-dark" /> Which email domains can self-join?
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Anyone who signs up with one of these domains lands in {company.name} as an
                      employee automatically — no invite. Add every domain your company uses.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {domains.map((d) => (
                        <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100">
                          @{d}
                          <button type="button" onClick={() => setDomains((cur) => cur.filter((x) => x !== d))} className="text-slate-400 hover:text-rose-500">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Input
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDomain(); } }}
                        placeholder="company.com"
                      />
                      <Button variant="outline" onClick={addDomain}>Add</Button>
                    </div>
                  </div>
                )}

                {/* branch: integration roster */}
                {signIn === 'integration' && (
                  <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Which system should we sync from?</p>
                    <p className="mt-1 text-xs text-slate-500">
                      We&apos;ll pull people and departments from here. You&apos;ll connect it on the Integrations page right after setup.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ROSTER_INTEGRATIONS.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => setRosterIntegration(r.key)}
                          className={cn(
                            'rounded-xl border px-3.5 py-2 text-sm font-semibold transition',
                            rosterIntegration === r.key
                              ? 'border-brand bg-brand/10 text-brand-dark ring-1 ring-brand/40'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700'
                          )}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {signIn === 'sso' && (
                  <p className="mt-5 flex items-start gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
                    Great choice. After setup, head to <span className="font-semibold">Integrations → Okta / SSO</span> to
                    connect your identity provider — we support SAML and SCIM provisioning.
                  </p>
                )}
                {signIn === 'manual' && (
                  <p className="mt-5 flex items-start gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
                    You&apos;ll invite teammates one by one from the <span className="font-semibold">People</span> page.
                    You can add your first admins in a moment.
                  </p>
                )}
              </div>
            )}

            {step.key === 'approval' && (
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Should trips need approval?
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Your default rule. You can always fine-tune it per person or department later.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {([
                    [true, 'Require approval', 'Out-of-policy (or every) trip goes to a manager before it books. More control.'],
                    [false, 'Book freely', 'In-policy trips book instantly, no approval. Fastest for travelers.'],
                  ] as [boolean, string, string][]).map(([v, t, d]) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setRequireApproval(v)}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition',
                        requireApproval === v
                          ? 'border-brand bg-brand/8 ring-1 ring-brand/40'
                          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {requireApproval === v && <Check className="h-4 w-4 text-brand-dark" />} {t}
                      </span>
                      <span className="text-xs leading-relaxed text-slate-500">{d}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step.key === 'departments' && (
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  What are your departments?
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Used for budgets, reporting, and so you can hand travel-rule setup to a department head.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {departments.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {d}
                      <button type="button" onClick={() => setDepartments((cur) => cur.filter((x) => x !== d))} className="text-slate-400 hover:text-rose-500">×</button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex max-w-sm gap-2">
                  <Input
                    value={deptInput}
                    onChange={(e) => setDeptInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDept(); } }}
                    placeholder="Add a department…"
                  />
                  <Button variant="outline" onClick={addDept}>Add</Button>
                </div>
              </div>
            )}

            {step.key === 'invite' && (
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Add any other admins
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Optional — invite anyone else who should help run the account. Each gets an email
                  invite to join as an admin. You can skip this and add people anytime.
                </p>
                {invites.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {invites.map((inv, i) => (
                      <li key={i} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                        <span><span className="font-medium text-slate-800 dark:text-slate-100">{inv.name}</span> <span className="text-slate-400">· {inv.email}</span></span>
                        <button type="button" onClick={() => setInvites((cur) => cur.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Name"><Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jordan Lee" /></Field>
                  <Field label="Work email"><Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInvite(); } }} placeholder="jordan@company.com" /></Field>
                  <div className="flex items-end"><Button variant="outline" onClick={addInvite}>Add</Button></div>
                </div>
              </div>
            )}

            {step.key === 'review' && (
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Ready to go live
                </h1>
                <p className="mt-2 text-sm text-slate-500">Here&apos;s what we&apos;ll set up for {company.name}.</p>
                <dl className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
                  <ReviewRow label="Sign-in">
                    {SIGN_IN_OPTIONS.find((o) => o.key === signIn)?.title ?? 'Not set'}
                    {signIn === 'domain_join' && domains.length > 0 && ` · ${domains.map((d) => `@${d}`).join(', ')}`}
                    {signIn === 'integration' && rosterIntegration && ` · ${ROSTER_INTEGRATIONS.find((r) => r.key === rosterIntegration)?.label}`}
                  </ReviewRow>
                  <ReviewRow label="Approvals">{requireApproval ? 'Trips need approval' : 'Book freely (in policy)'}</ReviewRow>
                  <ReviewRow label="Departments">{departments.length ? departments.join(', ') : 'None yet'}</ReviewRow>
                  <ReviewRow label="Admin invites">{invites.length ? `${invites.length} to send` : 'None'}</ReviewRow>
                </dl>
              </div>
            )}
          </div>

          {/* footer nav */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
            {stepIdx > 0 ? (
              <button onClick={back} className="text-sm font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">← Back</button>
            ) : (
              <span />
            )}
            {step.key === 'review' ? (
              <Button onClick={finish}>
                <Sparkles className="h-4 w-4" /> Finish setup
              </Button>
            ) : (
              <Button onClick={next} disabled={!canContinue}>
                {step.key === 'invite' && invites.length === 0 ? 'Skip for now' : 'Continue'} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact scoped setup for a department head with rules permission: they set the
 * travel approval rule for their own department (and nobody else's). Shown once
 * per head via AppShell's gate.
 */
export function DepartmentSetup({ onDone }: { onDone: () => void }) {
  const { activeUser, setDepartmentApprovalMode } = useStore();
  const dept = activeUser.department || 'your team';
  const firstName = (activeUser.name ?? 'there').trim().split(' ')[0] || 'there';
  const [mode, setMode] = useState<'pre_approval' | 'open'>('pre_approval');
  const [saved, setSaved] = useState(false);

  const save = () => {
    try {
      setDepartmentApprovalMode(activeUser.department, mode);
    } catch {
      /* ignore */
    }
    setSaved(true);
  };

  if (saved) {
    return (
      <CelebrationOverlay
        headline={<>Rules set for<br /><span className="text-brand">{dept}.</span></>}
        sub={`Thanks, ${firstName}! Trips in your department now follow the rule you chose. You can fine-tune it anytime from Policies.`}
        cta="Done →"
        onCta={onDone}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-navy-deep/97 px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8">
        <div className="mb-5 flex justify-center"><Logo imgClassName="h-7" /></div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-dark">
          <Shield className="h-3.5 w-3.5" /> Department head setup
        </span>
        <h1 className="mt-3 font-display text-2xl font-bold text-slate-900 dark:text-white">
          Set the travel rule for {dept}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          You can set how trips work for people in <span className="font-semibold text-slate-700 dark:text-slate-100">{dept}</span>.
          This applies to your department only.
        </p>
        <div className="mt-5 grid gap-3">
          {([
            ['pre_approval', 'Require approval', 'Trips in your department come to you before they book.'],
            ['open', 'Book freely', 'In-policy trips book instantly, no approval needed.'],
          ] as ['pre_approval' | 'open', string, string][]).map(([v, t, d]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMode(v)}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
                mode === v ? 'border-brand bg-brand/8 ring-1 ring-brand/40' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
              )}
            >
              <span className={cn('mt-0.5 grid h-5 w-5 place-items-center rounded-full border-2', mode === v ? 'border-brand bg-brand' : 'border-slate-300')}>
                {mode === v && <Check className="h-3 w-3 text-white" />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{t}</span>
                <span className="block text-xs text-slate-500">{d}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <button onClick={onDone} className="text-sm font-medium text-slate-400 hover:text-slate-600">Skip</button>
          <Button onClick={save}><Check className="h-4 w-4" /> Set the rule</Button>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}
