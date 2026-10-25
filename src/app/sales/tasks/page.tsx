'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCrm } from '@/lib/crmStore';
import { Card, PageHeader, cn } from '@/components/app/ui';
import { shortDate, todayISO } from '@/lib/format';
import { ME, TASK_LABEL, type CrmTask } from '@/lib/crm';
import { Check } from '@/components/icons';

export default function TasksPage() {
  const { companies, toggleTask } = useCrm();
  const [mineOnly, setMineOnly] = useState(true);

  const nameFor = (id: string) => companies.find((c) => c.id === id)?.name ?? '—';
  const today = todayISO();

  const tasks = companies
    .flatMap((c) => c.tasks)
    .filter((t) => (mineOnly ? t.owner === ME : true));

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const overdue = open.filter((t) => t.due < today).sort(byDue);
  const todayTasks = open.filter((t) => t.due === today).sort(byDue);
  const upcoming = open.filter((t) => t.due > today).sort(byDue);

  const groups: { title: string; items: CrmTask[]; tone?: 'red' | 'amber' }[] = [
    { title: 'Overdue', items: overdue, tone: 'red' },
    { title: 'Due today', items: todayTasks, tone: 'amber' },
    { title: 'Upcoming', items: upcoming },
    { title: 'Completed', items: done.sort(byDue).reverse() },
  ];

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Your follow-ups across every account, oldest due first."
        actions={
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {[
              { k: true, l: 'My tasks' },
              { k: false, l: 'All reps' },
            ].map((o) => (
              <button
                key={String(o.k)}
                onClick={() => setMineOnly(o.k)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  mineOnly === o.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-6">
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <Card key={g.title}>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-slate-900">
                {g.title}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    g.tone === 'red'
                      ? 'bg-red-50 text-red-600'
                      : g.tone === 'amber'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {g.items.length}
                </span>
              </h2>
              <div className="space-y-2">
                {g.items.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <button
                      onClick={() => toggleTask(t.companyId, t.id)}
                      aria-label={t.done ? 'Mark incomplete' : 'Mark complete'}
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                        t.done ? 'border-brand bg-brand text-navy-deep' : 'border-slate-300 hover:border-brand'
                      )}
                    >
                      {t.done && <Check className="h-3 w-3" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-sm',
                          t.done ? 'text-slate-400 line-through' : 'text-slate-700'
                        )}
                      >
                        {t.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {TASK_LABEL[t.type]} ·{' '}
                        <Link
                          href={`/sales/companies/${t.companyId}`}
                          className="hover:text-brand-dark hover:underline"
                        >
                          {nameFor(t.companyId)}
                        </Link>{' '}
                        · due {shortDate(t.due)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        )}
        {tasks.length === 0 && (
          <Card>
            <p className="text-sm text-slate-400">No tasks. You&apos;re all caught up.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function byDue(a: CrmTask, b: CrmTask) {
  return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
}
