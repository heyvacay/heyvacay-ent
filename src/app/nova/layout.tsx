import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Nova — HeyVacay Internal',
  description: 'HeyVacay enterprise operations console.',
  robots: { index: false, follow: false },
};

const NAV = [
  { href: '#overview', label: 'Overview' },
  { href: '#revenue', label: 'Revenue' },
  { href: '#companies', label: 'Companies' },
  { href: '#support', label: 'Ops queue' },
];

export default function NovaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-navy-deep text-mist">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-navy px-5 py-6 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/15 ring-1 ring-brand/30">
            <Sparkles className="h-4 w-4 text-brand" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold text-white">Nova</p>
            <p className="text-[11px] font-semibold text-brand">HeyVacay internal</p>
          </div>
        </div>

        <nav className="mt-9 flex-1 space-y-1">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-white"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <Link
          href="/app"
          className="rounded-lg px-3 py-2 text-xs font-medium text-muted hover:text-white"
        >
          ← Customer app
        </Link>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-navy/80 px-5 backdrop-blur sm:px-8">
          <p className="text-sm text-muted">Enterprise operations</p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Staging ·
            internal
          </span>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
