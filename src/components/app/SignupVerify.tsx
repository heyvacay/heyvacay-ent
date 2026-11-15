'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/app/ui';
import { Shield } from '@/components/icons';
import { authRegister, authVerify, authResend } from '@/lib/auth/client';

/**
 * Real email verification for the signup owner. Creates the credential record on
 * the server (which emails a 6-digit code), then confirms the code — the code is
 * generated and checked server-side, so this genuinely proves the owner controls
 * the inbox before the account goes live. On success the httpOnly session is set.
 *
 * Used in the signup "verify" step AFTER the password is set, so the one call
 * that registers also stores the chosen password.
 */
export function SignupVerify({
  email,
  company,
  companyId,
  firstName,
  lastName,
  password,
  onVerified,
}: {
  email: string;
  company?: string;
  companyId: string;
  firstName: string;
  lastName: string;
  password: string;
  onVerified: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const send = async () => {
    setError('');
    setBusy(true);
    const res = await authRegister({
      email,
      password,
      firstName,
      lastName,
      companyId,
      role: 'admin',
      userId: 'u_admin',
    });
    setBusy(false);
    if (res.exists) {
      setError('An account with this email already exists. Sign in instead.');
      return;
    }
    if (res.error && !res.needsVerify) {
      setError(res.error);
      return;
    }
    setSent(true);
  };

  const verify = async () => {
    setError('');
    setBusy(true);
    const res = await authVerify(email, code.trim());
    setBusy(false);
    if (res.error || !res.account) {
      setError(res.error || 'That code is invalid or has expired.');
      return;
    }
    onVerified();
  };

  const resend = async () => {
    await authResend(email);
    setResent(true);
  };

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-start gap-3 text-sm text-slate-600">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
        <p>
          Last step — confirm <span className="font-semibold text-slate-800">{email}</span> is
          really yours. This becomes the owner login{company ? ` for ${company}` : ''}.
        </p>
      </div>

      {!sent ? (
        <Button onClick={send} disabled={busy || !email}>
          {busy ? 'Sending…' : 'Email me a verification code'}
        </Button>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">
            Enter the 6-digit code we emailed to {email}.
          </p>
          <div className="flex items-start gap-2">
            <Input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="text-center text-lg font-semibold tracking-[0.3em]"
            />
            <Button onClick={verify} disabled={busy || code.length < 6}>
              {busy ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
          <button
            type="button"
            onClick={resend}
            className="mt-2 text-xs font-semibold text-brand-dark hover:underline"
          >
            {resent ? 'Code re-sent ✓' : "Didn't get it? Resend code"}
          </button>
        </>
      )}

      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
