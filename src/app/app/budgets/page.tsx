'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Button,
  Card,
  Input,
  PageHeader,
  ProgressBar,
  StatCard,
} from '@/components/app/ui';
import { money, pct } from '@/lib/format';

function BudgetRow({
  id,
  label,
  limit,
  spent,
  onSave,
}: {
  id: string;
  label: string;
  limit: number;
  spent: number;
  onSave: (id: string, limit: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(limit));
  const over = spent > limit;
  const nearly = limit > 0 && spent / limit > 0.8;

  return (
    <div className="py-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-800">{label}</p>
          <p className="text-xs text-slate-400">
            {money(spent)} spent · {pct(limit > 0 ? spent / limit : 0)} of budget
          </p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">$</span>
            <Input
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-32"
            />
            <Button
              size="sm"
              onClick={() => {
                onSave(id, Math.max(0, Number(draft) || 0));
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold text-slate-900">
              {money(limit)}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(String(limit));
                setEditing(true);
              }}
            >
              Edit
            </Button>
          </div>
        )}
      </div>
      <ProgressBar
        value={spent}
        max={limit}
        tone={over ? 'red' : nearly ? 'amber' : 'brand'}
      />
    </div>
  );
}

export default function BudgetsPage() {
  const { state, activeUser, isSuperAdmin, spentForScope, updateBudgetLimit, setScopedBudget, companySpend } =
    useStore();

  // Finance and super admins see the whole company. A team manager sees the
  // company T&E (read-only context) and manages only their own team.
  const isFinance = activeUser.department === 'Finance';
  const fullAccess = isSuperAdmin || isFinance;
  const myDept = activeUser.department;

  const company = state.budgets.find((b) => b.scope === 'company');
  const companyLimit = company?.limit ?? 0;

  const allDepts = Array.from(
    new Set(state.users.filter((u) => u.status === 'active').map((u) => u.department).filter(Boolean))
  ).sort();
  const shownDepts = fullAccess ? allDepts : [myDept];

  // Every active employee in scope — so budgets can be set even for people who
  // don't have one yet.
  const employees = state.users.filter(
    (u) => u.status === 'active' && (fullAccess || u.department === myDept)
  );
  const budgetForUser = (uid: string) =>
    state.budgets.find((b) => b.scope === 'employee' && b.refId === uid);
  const budgetForDept = (d: string) =>
    state.budgets.find((b) => b.scope === 'department' && b.refId === d);

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle={
          fullAccess
            ? 'Set the ceilings. HeyVacay keeps spend under them automatically.'
            : `Manage ${myDept}'s budgets. Company T&E is shown for context.`
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Company budget" value={money(companyLimit)} sub="Annual travel & expense" />
        <StatCard
          label="Committed"
          value={money(companySpend)}
          sub={`${pct(companyLimit > 0 ? companySpend / companyLimit : 0)} used`}
        />
        <StatCard
          accent
          label="Remaining"
          value={money(Math.max(0, companyLimit - companySpend))}
          sub="Across all departments"
        />
      </div>

      {company && (
        <Card className="mt-6">
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
            Company — annual T&amp;E{!fullAccess && ' (view only)'}
          </h2>
          {fullAccess ? (
            <div className="divide-y divide-slate-100">
              <BudgetRow
                id={company.id}
                label={company.label}
                limit={company.limit}
                spent={companySpend}
                onSave={updateBudgetLimit}
              />
            </div>
          ) : (
            <div className="py-3">
              <p className="text-sm text-slate-500">
                {money(companySpend)} spent of {money(companyLimit)} ·{' '}
                {pct(companyLimit > 0 ? companySpend / companyLimit : 0)}
              </p>
              <div className="mt-2">
                <ProgressBar value={companySpend} max={companyLimit} tone="brand" />
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
          {fullAccess ? 'By department' : 'Your team'}
        </h2>
        <div className="divide-y divide-slate-100">
          {shownDepts.map((d) => {
            const b = budgetForDept(d);
            return (
              <BudgetRow
                key={d}
                id={b?.id ?? `dept:${d}`}
                label={d}
                limit={b?.limit ?? 0}
                spent={spentForScope('department', d)}
                onSave={(_id, limit) => setScopedBudget('department', d, limit, d)}
              />
            );
          })}
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
          Per employee
        </h2>
        <p className="mb-1 text-xs text-slate-400">
          Every {fullAccess ? 'employee' : `${myDept} teammate`} — set a budget inline, even if they
          don&apos;t have one yet.
        </p>
        <div className="divide-y divide-slate-100">
          {employees.map((u) => {
            const b = budgetForUser(u.id);
            return (
              <BudgetRow
                key={u.id}
                id={b?.id ?? `user:${u.id}`}
                label={`${u.name} · ${u.department}`}
                limit={b?.limit ?? 0}
                spent={spentForScope('employee', u.id)}
                onSave={(_id, limit) => setScopedBudget('employee', u.id, limit, u.name)}
              />
            );
          })}
        </div>
      </Card>
    </div>
  );
}
