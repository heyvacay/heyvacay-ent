'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/app/ui';
import {
  ChartBar,
  Building,
  TrendUp,
  Calendar,
  Receipt,
  Users,
  Wallet,
} from '@/components/icons';
import { useCrm } from '@/lib/crmStore';
import { Logo } from '@/components/app/Logo';

const NAV = [
  { href: '/sales', label: 'Dashboard', icon: ChartBar },
  { href: '/sales/pipeline', label: 'Pipeline', icon: TrendUp },
  { href: '/sales/companies', label: 'Companies', icon: Building },
  { href: '/sales/commission', label: 'Commission', icon: Wallet },
  { href: '/sales/tasks', label: 'Tasks', icon: Calendar },
  { href: '/sales/contracts', label: 'Contracts', icon: Receipt },
  { href: '/sales/team', label: 'Team', icon: Users },
];

export default function SalesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { reps, currentRep, setCurrentRep, viewerRole } = useCrm();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/sales' ? pathname === '/sales' : pathname.startsWith(href);

  const Side = (
    <>
      <div className="px-5 py-5">
        <Logo tone="light" label="Sales · Nova" imgClassName="h-7" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-white/10 text-white ring-1 ring-white/15'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )}
            >
              <Icon className={cn('h-[18px] w-[18px]', active && 'text-brand')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <Link
          href="/app"
          className="block rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white"
        >
          ← Customer app
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[250px_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-navy-deep lg:flex">
        {Side}
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-navy-deep">
            {Side}
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 lg:hidden"
            aria-label="Menu"
          >
            <span className="block h-0.5 w-5 bg-current" />
            <span className="mt-1 block h-0.5 w-5 bg-current" />
            <span className="mt-1 block h-0.5 w-5 bg-current" />
          </button>
          <p className="text-sm font-medium text-slate-400">Internal sales console</p>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {currentRep.slice(0, 1)}
            </span>
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Signed in as</span>
              <select
                value={currentRep}
                onChange={(e) => setCurrentRep(e.target.value)}
                className="max-w-[9.5rem] truncate rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-brand"
                title="Switch signed-in rep"
              >
                {reps.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <span
              className={cn(
                'hidden rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline',
                viewerRole === 'C-Suite' ? 'bg-brand/15 text-brand-dark' : 'bg-slate-100 text-slate-500'
              )}
            >
              {viewerRole}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-6 sm:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
