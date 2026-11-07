'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/app/Logo';
import { useStore } from '@/lib/store';
import { markSignedIn } from '@/lib/session';

type Account = { key: string; id: string | null; name: string; domain: string };
const DEMO_KEY = 'hv_ent_demo_v2';
const ACCT_PREFIX = 'hv_ent_acct_';

type StoredUser = { id: string; name?: string; role?: string };
function readStored(key: string): { users?: StoredUser[]; company?: { id?: string; name?: string; domain?: string } } | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw).state ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Sign-in for HeyVacay Enterprise. A front-end gate that routes into the chosen
 * company's workspace (the SAME workspace a Nova rep sets up, so rep edits are
 * visible here). Real SSO + work-email auth replaces this when the backend is up.
 */
export default function SignInPage() {
  const { state } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([
    { key: DEMO_KEY, id: null, name: 'Demo company', domain: '' },
  ]);
  const [targetKey, setTargetKey] = useState<string>(DEMO_KEY);
  // Demo data vs. a brand-new-company experience.
  const [mode, setMode] = useState<'demo' | 'fresh'>('demo');
  useEffect(() => {
    try {
      setMode(localStorage.getItem('hv_ent_experience') === 'fresh' ? 'fresh' : 'demo');
    } catch {
      /* ignore */
    }
  }, []);
  const chooseDemo = () => {
    try {
      localStorage.setItem('hv_ent_experience', 'demo');
    } catch {
      /* ignore */
    }
    setMode('demo');
  };
  const startFresh = () => {
    try {
      localStorage.setItem('hv_ent_experience', 'fresh');
      // Wipe the default workspace + any active account so you truly start new.
      localStorage.removeItem('hv_ent_demo_v2');
      localStorage.removeItem('hv_ent_active_account');
      sessionStorage.removeItem('hv_view_as');
      sessionStorage.removeItem('hv_view_as_ctx');
    } catch {
      /* ignore */
    }
    window.location.href = '/signup';
  };

  // Enumerate every workspace in this browser so you can sign in as the actual
  // user of an account a rep set up — defaulting to the active one.
  useEffect(() => {
    const list: Account[] = [{ key: DEMO_KEY, id: null, name: 'Demo company', domain: '' }];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(ACCT_PREFIX)) continue;
        const st = readStored(k);
        list.push({
          key: k,
          id: st?.company?.id ?? k.slice(ACCT_PREFIX.length),
          name: st?.company?.name ?? 'Company',
          domain: st?.company?.domain ?? '',
        });
      }
      const active = localStorage.getItem('hv_ent_active_account');
      if (active) {
        const a = JSON.parse(active);
        if (a?.id && list.some((x) => x.id === a.id)) setTargetKey(ACCT_PREFIX + a.id);
      }
    } catch {
      /* ignore */
    }
    setAccounts(list);
  }, []);

  const target = accounts.find((a) => a.key === targetKey) ?? accounts[0];
  const targetUsers = (): StoredUser[] => readStored(targetKey)?.users ?? (state.users as StoredUser[]);

  const domain = email.includes('@') ? email.split('@')[1]?.trim() : '';
  const freeMail = /^(gmail|yahoo|outlook|hotmail|icloud|proton)\./i.test(domain ?? '');
  const showDomainJoin = !!domain && domain.includes('.') && !freeMail;

  // Commit the signed-in identity into the SELECTED account's workspace, point
  // the active-account pointer at it (so rep edits and the user's view share one
  // store), clear any rep overlay, then hard-navigate so /app re-reads it.
  const commitLogin = (userId: string, roleValue: string) => {
    try {
      const raw = localStorage.getItem(target.key);
      const parsed = raw ? (JSON.parse(raw) as { state?: Record<string, unknown>; role?: string }) : null;
      const baseState = parsed?.state ?? {};
      localStorage.setItem(
        target.key,
        JSON.stringify({ state: { ...baseState, activeUserId: userId }, role: roleValue })
      );
      if (target.id) {
        localStorage.setItem(
          'hv_ent_active_account',
          JSON.stringify({ id: target.id, name: target.name, domain: target.domain })
        );
      } else {
        localStorage.removeItem('hv_ent_active_account');
      }
      sessionStorage.removeItem('hv_view_as');
      sessionStorage.removeItem('hv_view_as_ctx');
      markSignedIn();
    } catch {
      /* ignore storage errors — /app still loads a usable workspace */
    }
    window.location.href = '/app';
  };

  // Demo auth: demo@demo.com/demo = full access; firstname@demo.com/demo views
  // that specific user. Real SSO/work-email auth replaces this with the backend.
  const enterFullAccess = () => {
    const users = targetUsers();
    const owner =
      users.find((u) => u.id === 'u_admin') ??
      users.find((u) => u.role === 'admin') ??
      users[0];
    commitLogin(owner?.id ?? 'u_admin', owner?.role ?? 'admin');
  };

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const em = email.trim().toLowerCase();
    const pw = password.trim().toLowerCase();
    if (pw !== 'demo') {
      setError('Incorrect password. For the demo, the password is "demo".');
      return;
    }
    if (em === 'demo@demo.com') {
      enterFullAccess();
      return;
    }
    if (em.endsWith('@demo.com')) {
      const first = em.split('@')[0];
      const match = targetUsers().find(
        (u) => (u.name ?? '').trim().toLowerCase().split(' ')[0] === first
      );
      if (match) {
        commitLogin(match.id, match.role ?? 'employee');
        return;
      }
      setError(`No demo user named "${first}" in ${target.name}. Try demo@demo.com for the owner.`);
      return;
    }
    setError('Use demo@demo.com for the owner, or firstname@demo.com to view a user.');
  };

  const SSO = [
    { label: 'Continue with Google', bg: 'bg-white text-slate-700 border border-slate-300' },
    { label: 'Continue with Microsoft', bg: 'bg-white text-slate-700 border border-slate-300' },
    { label: 'Continue with SSO (SAML)', bg: 'bg-slate-900 text-white' },
  ];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between bg-navy-deep p-10 text-white lg:flex">
        <Logo tone="light" imgClassName="h-7" />
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Corporate travel &amp; expense, <span className="text-brand">free.</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm text-slate-300">
            Book flights and hotels in policy, keep spend on budget, and earn your team rewards for
            every dollar saved.
          </p>
        </div>
        <p className="text-xs text-slate-500">© 2026 HeyVacay, Inc.</p>
      </div>

      {/* form */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo imgClassName="h-7" />
          </div>

          {/* Demo data vs. brand-new-company experience */}
          <div className="mb-5 flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            <button
              onClick={chooseDemo}
              className={`flex-1 rounded-md px-3 py-1.5 transition ${mode === 'demo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Demo data
            </button>
            <button
              onClick={() => setMode('fresh')}
              className={`flex-1 rounded-md px-3 py-1.5 transition ${mode === 'fresh' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              New user experience
            </button>
          </div>

          {mode === 'fresh' ? (
            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5 text-center">
              <h2 className="font-display text-xl font-bold text-slate-900">Start as a brand-new company</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                Experience HeyVacay exactly as a new customer would — nothing pre-filled. You&apos;ll
                sign up, set a password and get walked through everything.
              </p>
              <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-500">
                This clears the demo workspace on <span className="font-semibold">this device</span> so
                you begin from zero.
              </p>
              <button
                onClick={startFresh}
                className="mt-4 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-navy-deep shadow-sm hover:brightness-95"
              >
                Start fresh →
              </button>
              <button
                onClick={chooseDemo}
                className="mt-3 text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Never mind — use the demo
              </button>
            </div>
          ) : (
          <>
          <h2 className="font-display text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace.</p>

          {accounts.length > 1 && (
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Workspace</span>
              <select
                value={targetKey}
                onChange={(e) => setTargetKey(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {accounts.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.id ? a.name : 'Demo company (default)'}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-400">
                Sign in as the real user of a company a rep set up — you&apos;ll see their live data.
              </span>
            </label>
          )}

          <div className="mt-6 space-y-2">
            {SSO.map((s) => (
              <button
                key={s.label}
                onClick={enterFullAccess}
                className={`w-full rounded-lg py-2.5 text-sm font-semibold transition hover:brightness-95 ${s.bg}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or work email <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={signIn} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Work email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            {showDomainJoin && (
              <p className="rounded-lg bg-brand/10 px-3 py-2 text-xs text-brand-dark">
                If <span className="font-semibold">{domain}</span> is on HeyVacay, you&apos;ll be
                added to your company automatically once your email is verified.
              </p>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-navy-deep shadow-sm hover:brightness-95"
            >
              Sign in
            </button>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-600">Demo:</span> full access{' '}
              <code>demo@demo.com</code> · view a user <code>firstname@demo.com</code> (e.g.{' '}
              <code>danil@demo.com</code>). Password <code>demo</code>.
            </p>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            New here?{' '}
            <Link href="/signup" className="font-semibold text-brand-dark hover:underline">
              Set up your company
            </Link>
          </p>
          <p className="mt-1.5 text-center text-sm text-slate-500">
            Invited to a team?{' '}
            <Link href="/join" className="font-semibold text-brand-dark hover:underline">
              Accept your invite
            </Link>
          </p>
          <p className="mt-6 text-center text-xs text-slate-400">
            Internal team?{' '}
            <Link href="/sales" className="font-medium text-brand-dark hover:underline">
              Nova sales console
            </Link>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
