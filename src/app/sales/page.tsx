'use client';

import Link from 'next/link';
import { useCrm } from '@/lib/crmStore';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  ProgressBar,
  StatCard,
} from '@/components/app/ui';
import { money, num, shortDate, todayISO } from '@/lib/format';
import {
  ME,
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_ORDER,
  onboardingPct,
  weightedPipeline,
  winRate,
  wonValue,
  type AccountStatus,
} from '@/lib/crm';
import { pipelineReportPdf } from '@/lib/pdf';
import { Receipt, Sparkles } from '@/components/icons';

export default function SalesDashboard() {
  const { companies, reps } = useCrm();
  const today = todayISO();
  const quotaFor = (name: string) => reps.find((r) => r.name === name)?.quota ?? 0;

  const count = (s: AccountStatus) => companies.filter((c) => c.status === s).length;
  const mine = companies.filter((c) => c.accountManager === ME);
  const myDeals = mine.flatMap((c) => c.deals);
  const allTasks = companies.flatMap((c) => c.tasks);
  const myOpenTasks = allTasks.filter((t) => t.owner === ME && !t.done);
  const dueToday = myOpenTasks.filter((t) => t.due <= today);

  const spendUnderMgmt = companies
    .filter((c) => c.status === 'active' || c.status === 'onboarding')
    .reduce((s, c) => s + c.annualSpend, 0);

  const quota = quotaFor(ME);
  const won = wonValue(myDeals);
  const attainment = quota > 0 ? Math.round((won / quota) * 100) : 0;

  // Leaderboard — reps ranked by closed-won ACV.
  const board = reps
    .map((rep) => {
      const deals = companies.flatMap((c) => c.deals).filter((d) => d.owner === rep.name);
      return { rep: rep.name, won: wonValue(deals), quota: rep.quota };
    })
    .sort((a, b) => b.won - a.won);

  const activity = companies
    .flatMap((c) => c.activity.map((a) => ({ ...a, company: c.name, id: c.id })))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${ME.split(' ')[0]}`}
        subtitle="Your book of business across HeyVacay Enterprise."
        actions={
          <Button variant="outline" onClick={() => pipelineReportPdf(mine, ME)}>
            <Receipt className="h-4 w-4" /> Pipeline report PDF
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard accent label="Weighted forecast" value={money(Math.round(weightedPipeline(myDeals)))} sub="Your open deals" />
        <StatCard label="Closed won" value={money(won)} sub={`${winRate(myDeals)}% win rate`} />
        <StatCard label="Spend under mgmt" value={money(spendUnderMgmt)} sub="Active + onboarding" />
        <StatCard label="Tasks due" value={num(dueToday.length)} sub="Today or overdue" />
      </div>

      {/* quota */}
      <Card className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-900">Quota attainment</h2>
          <span className="text-sm font-semibold text-slate-500">
            {money(won)} / {money(quota)} · {attainment}%
          </span>
        </div>
        <ProgressBar value={won} max={quota} tone={attainment >= 100 ? 'brand' : attainment >= 60 ? 'amber' : 'red'} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* pipeline */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Pipeline</h2>
              <Link href="/sales/pipeline" className="text-sm font-medium text-brand-dark hover:underline">
                Open board
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-display text-2xl font-bold text-slate-900">{count(s)}</p>
                  <p className="text-xs font-medium text-slate-400">{STATUS_LABEL[s]}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* my accounts */}
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

          {/* leaderboard */}
          <Card>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Rep leaderboard</h2>
            <div className="space-y-3">
              {board.map((b, i) => {
                const pct = b.quota > 0 ? Math.round((b.won / b.quota) * 100) : 0;
                return (
                  <div key={b.rep} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={b.rep === ME ? 'font-semibold text-slate-900' : 'text-slate-700'}>
                          {b.rep}
                          {b.rep === ME && ' · you'}
                        </span>
                        <span className="text-slate-400">
                          {money(b.won)} · {pct}%
                        </span>
                      </div>
                      <div className="mt-1">
                        <ProgressBar value={b.won} max={b.quota} tone={pct >= 100 ? 'brand' : 'amber'} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* right rail */}
        <div className="space-y-6">
          {/* tasks due */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Tasks due</h2>
              <Link href="/sales/tasks" className="text-sm font-medium text-brand-dark hover:underline">
                All tasks
              </Link>
            </div>
            {dueToday.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing due. Nicely done.</p>
            ) : (
              <div className="space-y-2">
                {dueToday.slice(0, 6).map((t) => {
                  const co = companies.find((c) => c.id === t.companyId);
                  const overdue = t.due < today;
                  return (
                    <Link
                      key={t.id}
                      href={`/sales/companies/${t.companyId}`}
                      className="block rounded-xl border border-slate-200 p-3 hover:border-slate-300"
                    >
                      <p className="text-sm font-medium text-slate-700">{t.title}</p>
                      <p className="text-xs text-slate-400">
                        {co?.name} · due {shortDate(t.due)}
                        {overdue && <span className="ml-1 font-semibold text-red-600">overdue</span>}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* activity */}
          <Card>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-brand-dark" /> Recent activity
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
    </div>
  );
}
