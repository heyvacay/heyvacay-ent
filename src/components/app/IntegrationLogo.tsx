'use client';

import type { ReactNode } from 'react';

/**
 * Self-contained brand marks for each integration partner. Inline SVG (no
 * external logo service — Clearbit's was shut down, and fetching per-request
 * leaked the page to a third party and often failed), so logos always render,
 * work offline, and stay crisp in both themes. Each is a clean, brand-coloured
 * tile; the iconic multi-colour marks (Google, Slack) are drawn faithfully.
 */

/** A rounded brand tile with a bold glyph that scales with the tile (SVG text). */
function Tile({
  bg,
  fg = '#ffffff',
  children,
}: {
  bg: string;
  fg?: string;
  children: string;
}) {
  const fontSize = children.length > 1 ? 15 : 22;
  return (
    <span
      className="block h-full w-full overflow-hidden rounded-xl"
      style={{ background: bg, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}
    >
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
        <text
          x="20"
          y="21"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="var(--font-display, system-ui, sans-serif)"
          fill={fg}
        >
          {children}
        </text>
      </svg>
    </span>
  );
}

/** Google's four-colour "G" (simplified, recognisable). */
function GoogleMark() {
  return (
    <span className="grid h-full w-full place-items-center rounded-xl bg-white" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}>
      <svg viewBox="0 0 48 48" className="h-1/2 w-1/2" aria-hidden="true">
        <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.4h11.8c-.2 2-1.5 5-4.4 7l-.04.3 6.4 4.9.4.1c4.1-3.8 6.5-9.4 6.5-15.5z" />
        <path fill="#34A853" d="M24 46c5.8 0 10.7-1.9 14.3-5.2l-6.8-5.3c-1.8 1.3-4.3 2.2-7.5 2.2-5.7 0-10.6-3.8-12.3-9.1l-.3.02-6.6 5.1-.1.3C8.1 41.1 15.5 46 24 46z" />
        <path fill="#FBBC05" d="M11.7 28.6c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1l-.01-.3-6.7-5.2-.2.1C3.3 18 2.5 20.9 2.5 24s.8 6 2.3 9l6.9-5.4z" />
        <path fill="#EA4335" d="M24 10.8c4 0 6.8 1.7 8.3 3.2l6.1-5.9C34.7 4.6 29.8 2.5 24 2.5 15.5 2.5 8.1 7.4 4.8 15l6.9 5.4C13.4 15.1 18.3 10.8 24 10.8z" />
      </svg>
    </span>
  );
}

/** Slack's four-colour octothorpe (simplified). */
function SlackMark() {
  return (
    <span className="grid h-full w-full place-items-center rounded-xl bg-white" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}>
      <svg viewBox="0 0 48 48" className="h-1/2 w-1/2" aria-hidden="true">
        <g>
          <path fill="#36C5F0" d="M18 6a4 4 0 100 8h4V10a4 4 0 00-4-4z" />
          <path fill="#2EB67D" d="M42 18a4 4 0 10-8 0v4h4a4 4 0 004-4z" />
          <path fill="#ECB22E" d="M30 42a4 4 0 108 0v-4h-4a4 4 0 00-4 4z" />
          <path fill="#E01E5A" d="M6 30a4 4 0 108 0v-4h-4a4 4 0 00-4 4z" />
          <path fill="#36C5F0" d="M14 24a4 4 0 014-4h4v8h-4a4 4 0 01-4-4z" opacity="0.0" />
          <rect x="20" y="14" width="8" height="4" rx="2" fill="#2EB67D" />
          <rect x="30" y="20" width="4" height="8" rx="2" fill="#ECB22E" />
          <rect x="20" y="30" width="8" height="4" rx="2" fill="#E01E5A" />
          <rect x="14" y="20" width="4" height="8" rx="2" fill="#36C5F0" />
          <rect x="20" y="20" width="8" height="8" rx="2" fill="#4A154B" />
        </g>
      </svg>
    </span>
  );
}

type Brand = { render: () => ReactNode };

const BRANDS: Record<string, Brand> = {
  // Accounting
  quickbooks: { render: () => <Tile bg="#2CA01C">qb</Tile> },
  xero: { render: () => <Tile bg="#13B5EA">X</Tile> },
  netsuite: { render: () => <Tile bg="#122E4C">N</Tile> },
  // HR / HRIS
  workday: { render: () => <Tile bg="#0875E1">W</Tile> },
  bamboohr: { render: () => <Tile bg="#7AB800">b</Tile> },
  rippling: { render: () => <Tile bg="#11181C" fg="#F7C948">R</Tile> },
  gusto: { render: () => <Tile bg="#F45D48">g</Tile> },
  // Expense & cards
  expensify: { render: () => <Tile bg="#1A8E5F">E</Tile> },
  ramp: { render: () => <Tile bg="#11181C" fg="#E4F222">R</Tile> },
  brex: { render: () => <Tile bg="#FF5C35">b</Tile> },
  // Identity
  okta: { render: () => <Tile bg="#007DC1">O</Tile> },
  google: { render: () => <GoogleMark /> },
  // Comms
  slack: { render: () => <SlackMark /> },
  // Infra partners (not cards today, but used where referenced)
  opentable: { render: () => <Tile bg="#DA3743">OT</Tile> },
  openweather: { render: () => <Tile bg="#EB6E4B">OW</Tile> },
  weather: { render: () => <Tile bg="#EB6E4B">OW</Tile> },
  resend: { render: () => <Tile bg="#0B0B0B">R</Tile> },
  email: { render: () => <Tile bg="#0B0B0B">@</Tile> },
  stripe: { render: () => <Tile bg="#635BFF">S</Tile> },
  veryfi: { render: () => <Tile bg="#17A2B8">V</Tile> },
  aerodatabox: { render: () => <Tile bg="#1E40AF">FS</Tile> },
  flight_status: { render: () => <Tile bg="#1E40AF">FS</Tile> },
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
  const brand = BRANDS[id];
  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <span className={`block shrink-0 overflow-hidden ${className}`}>
      {brand ? (
        brand.render()
      ) : (
        <span className="grid h-full w-full place-items-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">
          {initials}
        </span>
      )}
    </span>
  );
}
