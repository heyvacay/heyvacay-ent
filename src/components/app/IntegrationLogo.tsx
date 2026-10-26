'use client';

import { useState } from 'react';

/**
 * Renders a partner integration's real brand logo (fetched from a logo
 * service by domain) with a graceful monogram fallback if it fails to load.
 */
const DOMAINS: Record<string, string> = {
  quickbooks: 'quickbooks.intuit.com',
  netsuite: 'netsuite.com',
  xero: 'xero.com',
  bamboohr: 'bamboohr.com',
  rippling: 'rippling.com',
  gusto: 'gusto.com',
  expensify: 'expensify.com',
  ramp: 'ramp.com',
  brex: 'brex.com',
  okta: 'okta.com',
  google: 'google.com',
  slack: 'slack.com',
};

export function IntegrationLogo({
  id,
  name,
  className = 'h-11 w-11',
}: {
  id: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const domain = DOMAINS[id];
  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!domain || failed) {
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500 ${className}`}
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-100 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={`${name} logo`}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-7 w-7 object-contain"
      />
    </span>
  );
}
