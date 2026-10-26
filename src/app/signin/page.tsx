'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles } from '@/components/icons';

/**
 * Sign-in for HeyVacay Enterprise. Today this is a front-end gate that routes
 * into the demo workspace; it moves to real auth against ent.nova when that
 * backend is stood up (and the sales console gets its own ent.sales.nova login).
 */
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/app');
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between bg-navy-deep p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/20 ring-1 ring-brand/30">
            <Sparkles className="h-4 w-4 text-brand" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold">HeyVacay</p>
            <p className="text-[11px] font-semibold text-brand">Enterprise</p>
          </div>
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Corporate travel &amp; expense, <span className="text-brand">free.</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm text-slate-300">
            Book flights and hotels in policy, keep spend on budget, and earn
            your team rewards for every dollar saved.
          </p>
        </div>
        <p className="text-xs text-slate-500">© 2026 HeyVacay, Inc.</p>
      </div>

      {/* form */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <span className="inline-grid h-9 w-9 place-items-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
              <Sparkles className="h-4 w-4 text-brand-dark" />
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace.</p>

          <form onSubmit={signIn} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Work email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-navy-deep shadow-sm hover:brightness-95"
            >
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            New here?{' '}
            <Link href="/signup" className="font-semibold text-brand-dark hover:underline">
              Set up your company
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
