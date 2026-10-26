'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/app/ui';
import {
  ChartBar,
  Building,
  Sparkles,
  TrendUp,
  Calendar,
  Receipt,
  Users,
} from '@/components/icons';
import { ME } from '@/lib/crm';

const NAV = [
  { href: '/sales', label: 'Dashboard', icon: ChartBar },
  { href: '/sales/pipeline', label: 'Pipeline', icon: TrendUp },
  { href: '/sales/companies', label: 'Companies', icon: Building },
  { href: '/sales/tasks', label: 'Tasks', icon: Calendar },
  { href: '/sales/contracts', label: 'Contracts', icon: Receipt },
  { href: '/sales/team', label: 'Team', icon: Users },
];

export default function SalesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/sales' ? pathname === '/sales' : pathname.startsWith(href);

  const Side = (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/20 ring-1 ring-brand/30">
          <Sparkles className="h-4 w-4 text-brand" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-bold text-white">HeyVacay</p>
          <p className="text-[11px] font-semibold text-brand">Sales · Nova</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
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
              {ME.slice(0, 1)}
            </span>
            <span className="hidden text-sm font-semibold text-slate-700 sm:block">
              {ME}
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
