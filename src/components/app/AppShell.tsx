'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Avatar, cn } from './ui';
import {
  ChartBar,
  Users,
  Wallet,
  Shield,
  Plane,
  Receipt,
  Gift,
  Calendar,
  Sparkles,
  Building,
  Globe,
  TrendUp,
  Bell,
  MapPin,
  Lock,
} from '@/components/icons';

type NavItem = { href: string; label: string; icon: typeof ChartBar };
type NavSection = { title: string | null; items: NavItem[] };

/** Deterministic numeric string of length n, seeded from a stable id. */
function seededDigits(seed: string, n: number): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = '';
  while (out.length < n) {
    h = Math.imul(h ^ out.length, 16777619);
    out += Math.abs(h % 1_000_000).toString().padStart(6, '0');
  }
  return out.slice(0, n);
}

/** Company account number — ENT<year>-<8 digits>. Admin-only. */
export function companyAccountNumber(companyId: string): string {
  return `ENT2026-${seededDigits(companyId, 8)}`;
}

/** Per-user number — first 4 of the company's random digits + 4 of their own. */
export function userNumber(companyId: string, userId: string): string {
  return seededDigits(companyId, 8).slice(0, 4) + seededDigits(userId, 4);
}

const ADMIN_NAV: NavSection[] = [
  {
    title: null,
    items: [
      { href: '/app/dashboard', label: 'Dashboard', icon: ChartBar },
      { href: '/app/book', label: 'Book travel', icon: MapPin },
    ],
  },
  {
    title: 'Travel',
    items: [
      { href: '/app/bookings', label: 'Bookings', icon: Plane },
      { href: '/app/events', label: 'Events', icon: Calendar },
      { href: '/app/restaurants', label: 'Dining', icon: Receipt },
      { href: '/app/approvals', label: 'Approvals', icon: Bell },
      { href: '/app/reports', label: 'Analytics', icon: TrendUp },
    ],
  },
  {
    title: 'Spend',
    items: [
      { href: '/app/budgets', label: 'Budgets', icon: Wallet },
      { href: '/app/expenses', label: 'Expenses', icon: Receipt },
      { href: '/app/billing', label: 'Billing', icon: Lock },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { href: '/app/people', label: 'People', icon: Users },
      { href: '/app/policies', label: 'Policies', icon: Shield },
      { href: '/app/integrations', label: 'Integrations', icon: Globe },
    ],
  },
];

const EMPLOYEE_NAV: NavSection[] = [
  {
    title: null,
    items: [
      { href: '/app/book', label: 'Home', icon: MapPin },
      { href: '/app/trips', label: 'My trips', icon: Calendar },
      { href: '/app/events', label: 'Events', icon: Users },
      { href: '/app/restaurants', label: 'Dining', icon: MapPin },
      { href: '/app/rewards', label: 'Rewards', icon: Gift },
      { href: '/app/expenses', label: 'Expenses', icon: Receipt },
      { href: '/app/me', label: 'My dashboard', icon: ChartBar },
    ],
  },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { state, activeUser, role, setActiveUser, setRole, reset } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewAs, setViewAs] = useState<string | null>(null);

  useEffect(() => {
    try {
      setViewAs(sessionStorage.getItem('hv_view_as'));
    } catch {
      /* ignore */
    }
  }, [pathname]);

  const exitViewAs = () => {
    try {
      sessionStorage.removeItem('hv_view_as');
      sessionStorage.removeItem('hv_view_as_ctx');
      window.dispatchEvent(new Event('hv-view-as-change'));
    } catch {
      /* ignore */
    }
    setViewAs(null);
    router.push('/sales');
  };

  const nav = role === 'admin' ? ADMIN_NAV : EMPLOYEE_NAV;

  const onSwitch = (id: string) => {
    const u = state.users.find((x) => x.id === id);
    if (!u) return;
    setActiveUser(id);
    setRole(u.role);
  };

  const SideContent = (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
          <Sparkles className="h-4 w-4 text-brand-dark" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-bold text-slate-900">
            HeyVacay
          </p>
          <p className="text-[11px] font-semibold text-brand-dark">Enterprise</p>
        </div>
      </div>

      <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
          <Building className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {state.company.name}
          </p>
          {role === 'admin' && (
            <p className="truncate text-[11px] text-slate-400">
              Acct {companyAccountNumber(state.company.id)}
            </p>
          )}
          <p className="truncate text-[11px] text-slate-400">
            User #{userNumber(state.company.id, activeUser.id)}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3">
        {nav.map((section, si) => (
          <div key={section.title ?? si} className="space-y-1">
            {section.title && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand/12 text-slate-900 ring-1 ring-brand/25'
                      : 'text-slate-600 hover:bg-slate-100'
                  )}
                >
                  <Icon
                    className={cn('h-[18px] w-[18px]', active && 'text-brand-dark')}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3">
        {role === 'admin' && (
          <Link
            href="/sales"
            className="block rounded-lg px-3 py-2 text-xs font-semibold text-brand-dark hover:bg-brand/10"
          >
            Sales console (Nova)
          </Link>
        )}
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ← Marketing site
        </Link>
        <button
          onClick={reset}
          className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          Reset demo data
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        {SideContent}
      </aside>

      {/* Sidebar — mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white">
            {SideContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Impersonation banner — set by the Sales console's "View as user". */}
        {viewAs && (
          <div className="flex items-center justify-between gap-3 bg-navy-deep px-4 py-2 text-sm text-white sm:px-6">
            <span className="truncate">
              Viewing <span className="font-semibold">{viewAs}</span> as account
              manager
            </span>
            <button
              onClick={exitViewAs}
              className="shrink-0 rounded-md bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
            >
              Exit to Sales
            </button>
          </div>
        )}
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div className="hidden text-sm text-slate-400 sm:block">
            {role === 'admin' ? 'Admin console' : 'Employee portal'}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <label className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
              Viewing as
              <select
                value={activeUser.id}
                onChange={(e) => onSwitch(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none focus:border-brand"
              >
                {state.users
                  .filter((u) => u.status !== 'deactivated')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.role}
                    </option>
                  ))}
              </select>
            </label>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-slate-100"
              >
                <Avatar name={activeUser.name} />
                <div className="hidden leading-tight text-left sm:block">
                  <p className="text-sm font-semibold text-slate-800">
                    {activeUser.name}
                  </p>
                  <p className="text-[11px] capitalize text-slate-400">
                    {activeUser.title}
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-400">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{activeUser.name}</p>
                      <p className="truncate text-xs text-slate-400">{activeUser.email}</p>
                    </div>
                    <Link
                      href="/app/preferences"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      User preferences
                    </Link>
                    <button
                      onClick={() => {
                        try {
                          sessionStorage.removeItem('hv_view_as');
                          sessionStorage.removeItem('hv_view_as_ctx');
                        } catch {
                          /* ignore */
                        }
                        window.location.href = '/signin';
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
