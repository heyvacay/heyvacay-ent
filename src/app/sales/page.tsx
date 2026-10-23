'use client';

import Link from 'next/link';
import { useCrm } from '@/lib/crmStore';
import { Badge, Card, PageHeader, StatCard } from '@/components/app/ui';
import { money, num, shortDate } from '@/lib/format';
import {
  ME,
  STATUS_LABEL,
  STATUS_ORDER,
  onboardingPct,
  type AccountStatus,
} from '@/lib/crm';

const STATUS_COLOR: Record<AccountStatus, 'slate' | 'amber' | 'green' | 'red'> = {
  lead: 'slate',
  onboarding: 'amber',
  active: 'green',
  churned: 'red',
};

export default function SalesDashboard() {
  const { companies } = useCrm();

  const count = (s: AccountStatus) => companies.filter((c) => c.status === s).length;
  const spendUnderMgmt = companies
    .filter((c) => c.status === 'active' || c.status === 'onboarding')
    .reduce((s, c) => s + c.annualSpend, 0);
  const savings = companies.reduce((s, c) => s + c.savings, 0);
  const mine = companies.filter((c) => c.accountManager === ME);

  const activity = companies
    .flatMap((c) => c.activity.map((a) => ({ ...a, company: c.name, id: c.id })))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${ME.split(' ')[0]}`}
        subtitle="Your book of business across HeyVacay Enterprise."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard accent label="Active accounts" value={count('active')} sub="Live & booking" />
        <StatCard label="In onboarding" value={count('onboarding')} sub="Getting set up" />
        <StatCard label="Open leads" value={count('lead')} sub="Not yet started" />
        <StatCard label="Savings delivered" value={money(savings)} sub="Annualized" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* pipeline + my accounts */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Pipeline</h2>
              <span className="text-sm text-slate-400">
                {money(spendUnderMgmt)} spend under management
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-display text-2xl font-bold text-slate-900">
                    {count(s)}
                  </p>
                  <p className="text-xs font-medium text-slate-400">{STATUS_LABEL[s]}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">My accounts</h2>
              <Link href="/sales/companies" className="text-sm font-medium text-brand-dark hover:underline">
                All companies
              </Link>
            </div>
            {mine.length === 0 ? (
              <p className="text-sm text-slate-400">No accounts assigned to you yet.</p>
            ) : (
              <div className="space-y-2">
                {mine.map((c) => (
                  <Link
                    key={c.id}
                    href={`/sales/companies/${c.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-slate-300"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">
                        {c.employees} employees · {money(c.annualSpend)}/yr
                      </p>
                    </div>
                    <Badge color={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    {c.status === 'onboarding' && (
                      <span className="hidden text-xs font-semibold text-amber-600 sm:block">
                        {onboardingPct(c)}%
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* activity */}
        <Card>
          <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
            Recent activity
          </h2>
          <div className="space-y-3">
            {activity.map((a, i) => (
              <div key={i} className="border-l-2 border-brand/40 pl-3">
                <p className="text-sm text-slate-700">{a.text}</p>
                <p className="text-xs text-slate-400">
                  {a.company} · {shortDate(a.date)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
