'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
} from '@/components/app/ui';
import { money2, shortDate, todayISO } from '@/lib/format';
import { ACCOUNTING_IDS } from '@/lib/seed';
import { Check, Globe } from '@/components/icons';
import type { ExpenseCategory, ExpenseStatus } from '@/lib/types';

const CATEGORIES: ExpenseCategory[] = [
  'Meals',
  'Ground transport',
  'Lodging',
  'Airfare',
  'Supplies',
  'Other',
];

function StatusBadge({ status }: { status: ExpenseStatus }) {
  if (status === 'approved') return <Badge color="green">Approved</Badge>;
  if (status === 'reimbursed') return <Badge color="brand">Reimbursed</Badge>;
  if (status === 'rejected') return <Badge color="red">Rejected</Badge>;
  return <Badge color="amber">Submitted</Badge>;
}

export default function ExpensesPage() {
  const {
    state,
    role,
    activeUser,
    userById,
    submitExpense,
    setExpenseStatus,
    syncExpense,
    syncAllApproved,
  } = useStore();
  const isAdmin = role === 'admin';
  const accounting = state.integrations.find(
    (i) => ACCOUNTING_IDS.includes(i.id) && i.status === 'connected'
  );
  const showPosting = isAdmin && !!accounting;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    merchant: '',
    category: 'Meals' as ExpenseCategory,
    amount: '',
    date: todayISO(),
    hasReceipt: true,
    note: '',
  });

  const visible = isAdmin
    ? state.expenses
    : state.expenses.filter((e) => e.userId === activeUser.id);

  const submitted = visible.filter((e) => e.status === 'submitted');
  const pendingTotal = submitted.reduce((s, e) => s + e.amount, 0);
  const approvedTotal = visible
    .filter((e) => e.status === 'approved' || e.status === 'reimbursed')
    .reduce((s, e) => s + e.amount, 0);
  const postable = visible.filter(
    (e) => (e.status === 'approved' || e.status === 'reimbursed') && !e.synced
  );

  const submit = () => {
    if (!form.merchant.trim() || !form.amount) return;
    submitExpense({
      userId: activeUser.id,
      merchant: form.merchant,
      category: form.category,
      amount: Number(form.amount) || 0,
      date: form.date,
      hasReceipt: form.hasReceipt,
      note: form.note || undefined,
    });
    setForm({
      merchant: '',
      category: 'Meals',
      amount: '',
      date: todayISO(),
      hasReceipt: true,
      note: '',
    });
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={
          isAdmin
            ? 'Review and approve what your team submits.'
            : 'Snap, submit, get reimbursed.'
        }
        actions={
          <Button onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Add expense'}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting review" value={submitted.length} />
        <StatCard label="Pending amount" value={money2(pendingTotal)} />
        <StatCard accent label="Approved" value={money2(approvedTotal)} />
      </div>

      {showPosting && accounting && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand-dark">
              <Globe className="h-5 w-5" />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-slate-800">
                Posting to {accounting.name}
              </p>
              <p className="text-slate-500">
                Approved expenses post to the right GL code automatically — no
                receipts chased.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={syncAllApproved}
            disabled={postable.length === 0}
          >
            {postable.length ? `Post ${postable.length} approved` : 'All posted'}
          </Button>
        </div>
      )}

      {open && (
        <Card className="my-6">
          <h2 className="mb-4 font-display text-lg font-bold text-slate-900">
            New expense
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Merchant">
              <Input
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                placeholder="Blue Bottle Coffee"
              />
            </Field>
            <Field label="Amount">
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="34.50"
              />
            </Field>
            <Field label="Category">
              <Select
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as ExpenseCategory,
                  })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Note (optional)">
              <Input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Client dinner — Acme"
              />
            </Field>
            <label className="flex items-center gap-2.5 pt-7 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.hasReceipt}
                onChange={(e) =>
                  setForm({ ...form, hasReceipt: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              Receipt attached
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={submit}>Submit expense</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-6">
        {visible.length === 0 ? (
          <EmptyState
            title="No expenses yet"
            sub="Add your first expense to get started."
          />
        ) : (
          <Card pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold sm:px-6">Merchant</th>
                    {isAdmin && (
                      <th className="px-5 py-3 font-semibold">Person</th>
                    )}
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Amount</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    {showPosting && (
                      <th className="px-5 py-3 font-semibold">Posting</th>
                    )}
                    {isAdmin && (
                      <th className="px-5 py-3 font-semibold text-right sm:px-6">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="px-5 py-3 sm:px-6">
                        <p className="font-medium text-slate-800">
                          {e.merchant}
                        </p>
                        {e.note && (
                          <p className="text-xs text-slate-400">{e.note}</p>
                        )}
                        {!e.hasReceipt && (
                          <p className="text-xs text-amber-600">No receipt</p>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3 text-slate-600">
                          {userById(e.userId)?.name}
                        </td>
                      )}
                      <td className="px-5 py-3 text-slate-600">{e.category}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                        {shortDate(e.date)}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {money2(e.amount)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                      {showPosting && (
                        <td className="px-5 py-3">
                          {e.synced ? (
                            <div>
                              <Badge color="green">
                                <Check className="h-3 w-3" /> Posted
                              </Badge>
                              <p className="mt-1 text-xs text-slate-400">
                                {e.glCode ?? state.accountingMap[e.category]}
                              </p>
                            </div>
                          ) : e.status === 'approved' ||
                            e.status === 'reimbursed' ? (
                            <div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => syncExpense(e.id)}
                              >
                                Post
                              </Button>
                              <p className="mt-1 text-xs text-slate-400">
                                {state.accountingMap[e.category]}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="px-5 py-3 sm:px-6">
                          {e.status === 'submitted' ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() =>
                                  setExpenseStatus(e.id, 'approved')
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  setExpenseStatus(e.id, 'rejected')
                                }
                              >
                                Reject
                              </Button>
                            </div>
                          ) : e.status === 'approved' ? (
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setExpenseStatus(e.id, 'reimbursed')
                                }
                              >
                                Mark reimbursed
                              </Button>
                            </div>
                          ) : (
                            <div className="text-right text-xs text-slate-300">
                              —
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
