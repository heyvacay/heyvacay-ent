'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Check, ArrowRight } from '@/components/icons';

const DEMO_PASSWORD = '20100603';
const GATE_KEY = 'hv_demo_ok';

type Mode = 'sales' | 'training';

interface Slide {
  section: string;
  title: string;
  body: string;
  points: string[];
  live?: { label: string; href: string };
  training?: boolean; // only shown in rep-training mode
}

const SLIDES: Slide[] = [
  {
    section: 'Overview',
    title: 'HeyVacay Enterprise',
    body: 'Corporate travel & expense that is 100% free to the company. We earn a commission on bookings — only when you save. Companies typically cut travel spend ~15% through negotiated rates and policy controls.',
    points: [
      'Free forever — no seat fees, no platform fees by default',
      '~15% below market on flights + hotels',
      'Every booking in policy, on budget, and rewarded',
    ],
    live: { label: 'Open the marketing site', href: '/' },
  },
  // ---------- Employee ----------
  {
    section: 'Employee',
    title: 'Search-first home',
    body: 'Travelers land on a HeyVacay.co-style search — hotels pre-selected — and book live flights and hotels at the same rates as the consumer site.',
    points: ['Live inventory via our backend', 'Hotels default tab', 'Clean number entry everywhere'],
    live: { label: 'Open the traveler app', href: '/app/book' },
  },
  {
    section: 'Employee',
    title: 'Active-trip view',
    body: 'The home changes when someone is travelling: "Get ready for your flight," on-time/delayed/cancelled status 4h out, a welcome with live weather on landing, and "N days left" mid-trip.',
    points: ['Context-aware greeting', 'Live weather (keyed)', 'Flight status'],
  },
  {
    section: 'Employee',
    title: 'In-policy first + savings points',
    body: 'Results show in-policy stays first, color-coded blue (in policy), amber (needs approval), red (blocked). Points reward SAVINGS — the cheaper vs market, the more you earn.',
    points: ['Blue / amber / red policy coding', 'Searched property highlighted', 'Points = savings, not spend'],
    live: { label: 'Try a hotel search', href: '/app/book' },
  },
  {
    section: 'Employee',
    title: 'Room selection (identical to HeyVacay.co)',
    body: 'Room cards show refundability + meal plan, in-policy status and per-room points, with full-screen photos (arrows, Esc to close).',
    points: ['Refundability + meal plan', 'Per-room policy + points', 'Full photo lightbox'],
  },
  {
    section: 'Employee',
    title: 'Events + group dinners',
    body: 'Company trips get an allow-list of hotels/flights, a group chat, and a group-dinner flow: opt in, vote a cuisine, vote a restaurant — the winner auto-books via OpenTable at the host’s deadline.',
    points: ['Allow-list travel', 'Group chat', 'Vote → auto-book dinner'],
    live: { label: 'Open Events', href: '/app/events' },
  },
  {
    section: 'Employee',
    title: 'Dining — book restaurants in-app',
    body: 'Search restaurants by city/cuisine and book end-to-end. If the requested time is taken, we clearly say so and offer the closest open times.',
    points: ['OpenTable-powered', 'Requested-time fallback', 'Whole flow on our app'],
    live: { label: 'Open Dining', href: '/app/restaurants' },
  },
  {
    section: 'Employee',
    title: 'Preferences & rewards',
    body: 'Travelers manage saved cards, passports, and notification preferences, and bank points on every dollar saved.',
    points: ['Saved cards + passports', 'Email/SMS preferences', 'Rewards ledger'],
    live: { label: 'Open preferences', href: '/app/preferences' },
  },
  // ---------- Admin ----------
  {
    section: 'Admin',
    title: 'Admin dashboard',
    body: 'A live view of spend, savings, budgets, approvals waiting, and recent activity across the company.',
    points: ['Spend + savings', 'Budget health', 'Approvals queue'],
    live: { label: 'Open admin dashboard', href: '/app/dashboard' },
  },
  {
    section: 'Admin',
    title: 'Approvals — review & decide',
    body: 'Admins open a full review page with photos of the requested stay, policy + budget impact, and a comment (visible-to-traveler toggle). "Approve if changed" proposes a different room/price the traveler accepts or declines.',
    points: ['Photos + room requested', 'Comment visible to traveler', 'Approve-if-changed offers'],
    live: { label: 'Open approvals', href: '/app/approvals' },
  },
  {
    section: 'Admin',
    title: 'Policies you can actually read',
    body: 'Plain-English rules: multiple nightly-rate tiers (over $400 approve, over $1,000 block), per-city scoping, and flight cabin by distance with a live preview. Block means block — not "needs approval."',
    points: ['Multiple tiers, add/remove', 'Per-city rules', 'Flight cabin by duration'],
    live: { label: 'Open policies', href: '/app/policies' },
  },
  {
    section: 'Admin',
    title: 'People, billing & integrations',
    body: 'Manage users (roles, positions, reset password, deactivate). Choose billing: company card, employee-pays, or Net 30 (routed to a sales rep). Connect accounting/HR/identity integrations with real logos.',
    points: ['User management', 'Card / employee / Net 30', 'Real integration logos'],
    live: { label: 'Open billing', href: '/app/billing' },
  },
  // ---------- Rep training only ----------
  {
    section: 'Nova CRM',
    title: 'Nova — the sales engine',
    body: 'Our internal CRM: pipeline, companies, deals, tasks, contracts, team quotas, and live customer data — better than a generic CRM because it is wired to the product.',
    points: ['Pipeline + forecast', 'Editable team quotas', 'Live account data'],
    live: { label: 'Open Nova', href: '/sales' },
    training: true,
  },
  {
    section: 'Nova CRM',
    title: 'Accounts with real data',
    body: 'Open a company to see actual bookings, spend, and savings pulled from their workspace, onboarding progress, and a Net-30 request when they raise one.',
    points: ['Live bookings/savings', 'Onboarding tracker', 'Net-30 requests surface here'],
    live: { label: 'Open companies', href: '/sales/companies' },
    training: true,
  },
  {
    section: 'Nova CRM',
    title: 'Contracts + e-signature',
    body: 'Nova asks a few questions and generates a signed-ready contract PDF. Share a sign link; both parties sign in-app — no DocuSign. Self-signups flow straight into the pipeline with a welcome task.',
    points: ['Guided contract generator', 'Shareable e-sign link', 'Self-signup → CRM'],
    live: { label: 'Open contracts', href: '/sales/contracts' },
    training: true,
  },
  {
    section: 'Close',
    title: 'How companies save',
    body: 'Negotiated rates (~15% under market), policy controls that stop overspend before it happens, savings-based rewards that nudge cheaper choices, and zero software cost. That is the pitch.',
    points: ['~15% below market', 'Overspend blocked up front', 'Free — we win when you save'],
    live: { label: 'See the savings calculator', href: '/#calculator' },
  },
];

export default function DemoPage() {
  const [ok, setOk] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GATE_KEY) === '1') setOk(true);
    } catch {
      /* ignore */
    }
  }, []);

  const slides = useMemo(
    () => SLIDES.filter((s) => (mode === 'training' ? true : !s.training)),
    [mode]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!mode) return;
      if (e.key === 'ArrowRight') setI((n) => Math.min(slides.length - 1, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, slides.length]);

  // ----- password gate -----
  if (!ok) {
    return (
      <Shell>
        <div className="w-full max-w-sm text-center">
          <Badge>Demo access</Badge>
          <h1 className="mt-4 font-display text-2xl font-bold text-white">Enter the demo password</h1>
          <input
            type="password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setErr(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (pw === DEMO_PASSWORD) {
                  try {
                    sessionStorage.setItem(GATE_KEY, '1');
                  } catch {
                    /* ignore */
                  }
                  setOk(true);
                } else setErr(true);
              }
            }}
            placeholder="Password"
            className="mt-5 w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-center text-white outline-none placeholder:text-white/40 focus:border-brand"
          />
          {err && <p className="mt-2 text-sm text-red-300">Incorrect password.</p>}
          <button
            onClick={() => {
              if (pw === DEMO_PASSWORD) {
                try {
                  sessionStorage.setItem(GATE_KEY, '1');
                } catch {
                  /* ignore */
                }
                setOk(true);
              } else setErr(true);
            }}
            className="mt-4 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-navy-deep hover:brightness-95"
          >
            Enter
          </button>
        </div>
      </Shell>
    );
  }

  // ----- mode select -----
  if (!mode) {
    return (
      <Shell>
        <div className="w-full max-w-2xl">
          <div className="text-center">
            <Badge>Choose your demo</Badge>
            <h1 className="mt-4 font-display text-3xl font-bold text-white">What are we showing today?</h1>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <ModeCard
              title="Sales demo"
              sub="Admin + employee experience — every feature a customer sees."
              onClick={() => {
                setMode('sales');
                setI(0);
              }}
            />
            <ModeCard
              title="Rep training demo"
              sub="Everything, including Nova CRM and how we sell + close."
              onClick={() => {
                setMode('training');
                setI(0);
              }}
            />
          </div>
        </div>
      </Shell>
    );
  }

  // ----- deck -----
  const s = slides[i];
  return (
    <Shell>
      <div className="w-full max-w-3xl">
        {/* progress */}
        <div className="mb-6 flex items-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx <= i ? 'bg-brand' : 'bg-white/15'
              }`}
            />
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{s.section}</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-white">{s.title}</h2>
          <p className="mt-3 text-base leading-relaxed text-slate-300">{s.body}</p>
          <ul className="mt-5 space-y-2">
            {s.points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-slate-200">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {p}
              </li>
            ))}
          </ul>
          {s.live && (
            <a
              href={s.live.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-navy-deep hover:brightness-95"
            >
              {s.live.label} <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* nav */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 disabled:opacity-30"
          >
            ← Back
          </button>
          <p className="text-sm text-slate-400">
            {i + 1} / {slides.length}
          </p>
          {i < slides.length - 1 ? (
            <button
              onClick={() => setI((n) => Math.min(slides.length - 1, n + 1))}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => setMode(null)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-navy-deep hover:brightness-95"
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-navy-deep via-navy to-surface px-5 py-12">
      <div className="pointer-events-none fixed left-6 top-6 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/20 ring-1 ring-brand/30">
          <Sparkles className="h-4 w-4 text-brand" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-bold text-white">HeyVacay</p>
          <p className="text-[11px] font-semibold text-brand">Enterprise · Demo</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
      {children}
    </span>
  );
}

function ModeCard({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-brand/40 hover:bg-white/10"
    >
      <p className="font-display text-lg font-bold text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-300">{sub}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">
        Start <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}
