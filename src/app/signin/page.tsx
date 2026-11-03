'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/app/Logo';
import { useStore } from '@/lib/store';

/**
 * Sign-in for HeyVacay Enterprise. Today this is a front-end gate that routes
 * into the demo workspace; it moves to real auth (SSO + work-email, with
 * domain-based auto-join) against ent.nova when that backend is stood up.
 */
export default function SignInPage() {
  const router = useRouter();
  const { state, setActiveUser, setRole } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const domain = email.includes('@') ? email.split('@')[1]?.trim() : '';
  const freeMail = /^(gmail|yahoo|outlook|hotmail|icloud|proton)\./i.test(domain ?? '');
  const showDomainJoin = !!domain && domain.includes('.') && !freeMail;

  // Demo auth: demo@demo.com/demo = full access; firstname@demo.com/demo views
  // that specific user. Real SSO/work-email auth replaces this with the backend.
  const enterFullAccess = () => {
    const owner =
      state.users.find((u) => u.id === 'u_admin') ??
      state.users.find((u) => u.role === 'admin') ??
      state.users[0];
    if (owner) setActiveUser(owner.id);
    setRole('admin');
    router.push('/app');
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
      const match = state.users.find(
        (u) => (u.name ?? '').trim().toLowerCase().split(' ')[0] === first
      );
      if (match) {
        setActiveUser(match.id);
        setRole(match.role);
        router.push('/app');
        return;
      }
      setError(`No demo user named "${first}". Try demo@demo.com for full access.`);
      return;
    }
    setError('Use demo@demo.com for full access, or firstname@demo.com to view a user.');
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
          <h2 className="font-display text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace.</p>

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
        </div>
      </div>
    </div>
  );
}
