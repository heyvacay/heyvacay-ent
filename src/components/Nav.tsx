'use client';

import { useEffect, useState } from 'react';

const LINKS = [
  { href: '#travel', label: 'Travel' },
  { href: '#expense', label: 'Expense' },
  { href: '#rewards', label: 'Rewards' },
  { href: '#transparency', label: 'How we earn' },
  { href: '#pricing', label: 'Pricing' },
];

// Where existing users log in / where company signup begins. Point these at the
// real platform routes once the app + auth are wired.
const SIGN_IN_URL = '/app';
const GET_STARTED_URL = '/app';

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5" aria-label="HeyVacay Enterprise home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 20c3-1 5-1 9-1s6 0 9 1"
            stroke="var(--color-brand)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 19c-1.5-4-1.5-8 0-13 2.8 2.2 4 6.5 2.8 10"
            stroke="var(--color-brand)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 6C9.5 4.5 6.8 4.3 4.5 5.4 6.6 7.9 9 9.2 11.6 9"
            stroke="#8ef3fa"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-display text-[17px] font-bold tracking-tight text-white">
        HeyVacay{' '}
        <span className="font-medium text-brand">Enterprise</span>
      </span>
    </a>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'glass border-b border-line'
          : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />

        <div className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={SIGN_IN_URL}
            className="rounded-full px-4 py-2 text-sm font-semibold text-mist transition-colors hover:text-white"
          >
            Sign in
          </a>
          <a
            href={GET_STARTED_URL}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-navy-deep shadow-[0_0_0_1px_rgba(35,227,239,.5)] transition-all hover:shadow-glow"
          >
            Get started free
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg text-white lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="glass border-t border-line lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-mist hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <a
                href={SIGN_IN_URL}
                className="rounded-full border border-line px-5 py-3 text-center text-sm font-semibold text-white"
              >
                Sign in
              </a>
              <a
                href={GET_STARTED_URL}
                onClick={() => setOpen(false)}
                className="rounded-full bg-brand px-5 py-3 text-center text-sm font-bold text-navy-deep"
              >
                Get started free
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
