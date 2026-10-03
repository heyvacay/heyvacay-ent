'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from '@/components/icons';

const ADMIN_NAV = [
  { href: '/app/dashboard', label: 'Dashboard', icon: ChartBar },
  { href: '/app/people', label: 'People', icon: Users },
  { href: '/app/budgets', label: 'Budgets', icon: Wallet },
  { href: '/app/policies', label: 'Policies', icon: Shield },
  { href: '/app/bookings', label: 'Bookings', icon: Plane },
  { href: '/app/expenses', label: 'Expenses', icon: Receipt },
];

const EMPLOYEE_NAV = [
  { href: '/app/me', label: 'My dashboard', icon: ChartBar },
  { href: '/app/book', label: 'Book travel', icon: Plane },
  { href: '/app/trips', label: 'My trips', icon: Calendar },
  { href: '/app/rewards', label: 'Rewards', icon: Gift },
  { href: '/app/expenses', label: 'Expenses', icon: Receipt },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { state, activeUser, role, setActiveUser, setRole, reset } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          <p className="text-[11px] text-slate-400">Free plan · all features</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
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
      </nav>

      <div className="border-t border-slate-200 p-3">
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
            <div className="flex items-center gap-2.5">
              <Avatar name={activeUser.name} />
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {activeUser.name}
                </p>
                <p className="text-[11px] capitalize text-slate-400">
                  {activeUser.title}
                </p>
              </div>
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
