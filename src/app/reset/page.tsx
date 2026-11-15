'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/app/Logo';
import { authReset, commitRealLogin } from '@/lib/auth/client';

function ResetInner() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const token = params.get('token') ?? '';
  const missing = !email || !token;

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const longEnough = password.length >= 8;
  const match = password.length > 0 && password === password2;
  const ready = longEnough && match && !missing;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!ready) return;
    setBusy(true);
    const res = await authReset(email, token, password);
    setBusy(false);
    if (res.error || !res.account) {
      setError(res.error || 'This reset link is invalid or has expired.');
      return;
    }
    // Password reset + verified + signed in — drop straight into the app.
    commitRealLogin(res.account);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-navy-deep p-10 text-white lg:flex">
        <Logo tone="light" imgClassName="h-7" />
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Choose a new <span className="text-brand">password.</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm text-slate-300">
            Pick something at least 8 characters. You&apos;ll be signed in right after.
          </p>
        </div>
        <p className="text-xs text-slate-500">© 2026 HeyVacay, Inc.</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo imgClassName="h-7" />
          </div>

          {missing ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <h2 className="font-display text-xl font-bold text-slate-900">Invalid reset link</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                This link is missing information or has already been used. Request a fresh one.
              </p>
              <Link
                href="/forgot"
                className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-navy-deep shadow-sm hover:brightness-95"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold text-slate-900">Set a new password</h2>
              <p className="mt-1 text-sm text-slate-500">
                For <span className="font-semibold">{email}</span>
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">New password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  {password.length > 0 && !longEnough && (
                    <span className="mt-1 block text-xs text-red-500">Must be at least 8 characters.</span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Confirm password</span>
                  <input
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  {password2.length > 0 && !match && (
                    <span className="mt-1 block text-xs text-red-500">Passwords don&apos;t match.</span>
                  )}
                </label>
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={busy || !ready}
                  className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-navy-deep shadow-sm hover:brightness-95 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Set password & sign in'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-slate-400">Loading…</div>}>
      <ResetInner />
    </Suspense>
  );
}
