'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Input } from '@/components/app/ui';
import { Check, Shield } from '@/components/icons';
import { sendEmail } from '@/lib/email';

/**
 * Email verification step. We "email" a 6-digit code to the address and ask the
 * person to type it back. Wiring runs through the same transactional email path
 * as the rest of the app; for the demo (where you can't open the inbox) the code
 * is also shown on screen so the flow is testable end-to-end.
 */
export function EmailVerify({
  email,
  company,
  onVerified,
  cta = 'Verify & continue',
}: {
  email: string;
  company?: string;
  onVerified: () => void;
  cta?: string;
}) {
  const [code, setCode] = useState('');
  const [entered, setEntered] = useState('');
  const [error, setError] = useState(false);
  const [sentAt, setSentAt] = useState<number>(0);
  const sentOnce = useRef(false);

  const send = () => {
    const c = String(Math.floor(100000 + Math.random() * 900000));
    setCode(c);
    setEntered('');
    setError(false);
    setSentAt(Date.now());
    sendEmail('verifyCode', email, { code: c, company });
  };

  // Send a code the first time this screen mounts for a given email.
  useEffect(() => {
    if (!sentOnce.current && email) {
      sentOnce.current = true;
      send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const submit = () => {
    if (entered.trim() === code) {
      setError(false);
      onVerified();
    } else {
      setError(true);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-start gap-3 rounded-xl bg-brand/8 px-4 py-3 text-sm text-slate-600">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />
        <p>
          We sent a 6-digit code to{' '}
          <span className="font-semibold text-slate-800">{email || 'your email'}</span>. Enter it
          below to confirm it&apos;s really you.
        </p>
      </div>

      <div className="flex items-start gap-2">
        <Input
          value={entered}
          onChange={(e) => {
            setEntered(e.target.value.replace(/\D/g, '').slice(0, 6));
            setError(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="123456"
          inputMode="numeric"
          className="max-w-[180px] text-center text-lg font-semibold tracking-[0.3em]"
          autoFocus
        />
        <Button onClick={submit} disabled={entered.length !== 6}>
          <Check className="h-4 w-4" /> {cta}
        </Button>
      </div>

      {error && (
        <p className="mt-2 text-sm font-medium text-red-600">
          That code doesn&apos;t match. Check it and try again.
        </p>
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
        <button type="button" onClick={send} className="font-medium text-brand-dark hover:underline">
          Resend code
        </button>
        {sentAt > 0 && <span>Code sent</span>}
      </div>

      {/* Demo convenience: the inbox isn't reachable here, so surface the code. */}
      {code && (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Demo only — your code is{' '}
          <span className="font-mono font-semibold text-slate-700">{code}</span> (in production
          this only arrives by email).
        </p>
      )}
    </div>
  );
}
