'use client';

import type { ReactNode } from 'react';
import { ConfettiAnimation } from './ConfettiAnimation';
import { Logo } from './Logo';
import { Button } from './ui';

/**
 * A full-screen branded celebration: confetti over a navy backdrop with the
 * HeyVacay Enterprise lockup, a big headline and a sub-line. Used for the
 * signup "you're live" moment and a new teammate's first login.
 */
export function CelebrationOverlay({
  headline,
  sub,
  cta,
  onCta,
  footnote,
}: {
  headline: ReactNode;
  sub: ReactNode;
  cta?: string;
  onCta?: () => void;
  footnote?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-navy-deep px-6 text-center">
      {/* soft brand glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #23e3ef 0%, transparent 70%)' }}
      />
      <ConfettiAnimation durationMs={9000} />
      <div className="relative z-[70] w-full max-w-xl animate-[fadeUp_.6s_ease-out]">
        <div className="mb-7 flex justify-center">
          <Logo tone="light" imgClassName="h-10" />
        </div>
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
          {headline}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-300">{sub}</p>
        {cta && (
          <div className="mt-8 flex justify-center">
            <Button onClick={onCta} className="px-8 py-3 text-base">
              {cta}
            </Button>
          </div>
        )}
        {footnote && <p className="mt-5 text-xs text-slate-400">{footnote}</p>}
      </div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
