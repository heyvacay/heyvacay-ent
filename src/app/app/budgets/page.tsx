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
  const { state, spentForScope, updateBudgetLimit, companySpend, userById } =
    useStore();

  const company = state.budgets.find((b) => b.scope === 'company');
  const depts = state.budgets.filter((b) => b.scope === 'department');
  const perEmployee = state.budgets.filter((b) => b.scope === 'employee');
  const companyLimit = company?.limit ?? 0;

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Set the ceilings. HeyVacay keeps spend under them automatically."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Company budget"
          value={money(companyLimit)}
          sub="Annual travel & expense"
        />
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
            Company — annual T&amp;E
          </h2>
          <div className="divide-y divide-slate-100">
            <BudgetRow
              id={company.id}
              label={company.label}
              limit={company.limit}
              spent={companySpend}
              onSave={updateBudgetLimit}
            />
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
          By department
        </h2>
        <div className="divide-y divide-slate-100">
          {depts.map((b) => (
            <BudgetRow
              key={b.id}
              id={b.id}
              label={b.label}
              limit={b.limit}
              spent={spentForScope('department', b.refId)}
              onSave={updateBudgetLimit}
            />
          ))}
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
          Per employee
        </h2>
        <div className="divide-y divide-slate-100">
          {perEmployee.map((b) => (
            <BudgetRow
              key={b.id}
              id={b.id}
              label={userById(b.refId ?? '')?.name ?? b.label}
              limit={b.limit}
              spent={spentForScope('employee', b.refId)}
              onSave={updateBudgetLimit}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
