'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/app/Logo';
import { authForgot } from '@/lib/auth/client';

/**
 * Forgot-password: enter your work email and we send a reset link. The response
 * is intentionally identical whether or not an account exists, so this screen
 * can't be used to probe which emails are registered.
 */
export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    await authForgot(email.trim());
    setBusy(false);
    setSent(true);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-navy-deep p-10 text-white lg:flex">
        <Logo tone="light" imgClassName="h-7" />
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Back to booking in <span className="text-brand">no time.</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm text-slate-300">
            Reset your password securely — we&apos;ll email you a single-use link that expires in an
            hour.
          </p>
        </div>
        <p className="text-xs text-slate-500">© 2026 HeyVacay, Inc.</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Logo imgClassName="h-7" />
          </div>

          {sent ? (
            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/20 text-2xl">
                ✉️
              </div>
              <h2 className="mt-3 font-display text-xl font-bold text-slate-900">Check your email</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                If <span className="font-semibold">{email.trim()}</span> has a HeyVacay account,
                we&apos;ve sent a link to reset your password. It expires in 60 minutes.
              </p>
              <Link
                href="/signin"
                className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-navy-deep shadow-sm hover:brightness-95"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold text-slate-900">Reset your password</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your work email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
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
                <button
                  type="submit"
                  disabled={busy || !email.trim()}
                  className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-navy-deep shadow-sm hover:brightness-95 disabled:opacity-60"
                >
                  {busy ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="mt-4 text-center text-sm text-slate-500">
                Remembered it?{' '}
                <Link href="/signin" className="font-semibold text-brand-dark hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
