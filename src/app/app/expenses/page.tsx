'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { money, money2, shortDate, todayISO } from '@/lib/format';
import { ACCOUNTING_IDS } from '@/lib/seed';
import { Check, Globe, Receipt, Shield } from '@/components/icons';
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
    isSuperAdmin,
    submitExpense,
    setExpenseStatus,
    syncExpense,
    syncAllApproved,
  } = useStore();
  const isAdmin = role === 'admin';
  const [expDept, setExpDept] = useState<'all' | string>('all');
  const [expPerson, setExpPerson] = useState<'all' | string>('all');
  const accounting = state.integrations.find(
    (i) => ACCOUNTING_IDS.includes(i.id) && i.status === 'connected'
  );
  const showPosting = isAdmin && !!accounting;
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanTripRef = useRef('');
  const [tool, setTool] = useState<null | 'perdiem'>(null);
  // Expense decision modal (approve/reject with an optional comment).
  const [decide, setDecide] = useState<{ id: string; kind: 'approved' | 'rejected' } | null>(
    null
  );
  const [decideNote, setDecideNote] = useState('');
  const [form, setForm] = useState({
    merchant: '',
    category: 'Meals' as ExpenseCategory,
    amount: '',
    date: todayISO(),
    hasReceipt: true,
    note: '',
    tripId: '' as string,
  });

  // My trips, newest first — to tie an expense to the trip it belongs to.
  const myTrips = state.bookings
    .filter((b) => b.travelerId === activeUser.id && b.status !== 'cancelled')
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  // Deep links from the active-trip quick actions: ?new=1 opens the form,
  // ?scan=1 runs the receipt scanner, and ?trip=<bookingId> ties it to a trip.
  const params = useSearchParams();
  const handledParams = useRef(false);
  useEffect(() => {
    if (handledParams.current) return;
    const trip = params.get('trip') || '';
    const wantScan = params.get('scan') === '1';
    const wantNew = params.get('new') === '1';
    if (trip || wantScan || wantNew) {
      handledParams.current = true;
      if (trip) setForm((f) => ({ ...f, tripId: trip }));
      if (wantScan) scanReceipt(trip);
      else if (wantNew) setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Admins can scope to their team and filter by sub-team / person.
  const teamUsers = state.users.filter(
    (u) => u.status === 'active' && (isSuperAdmin || u.department === activeUser.department)
  );
  const teamDepartments = Array.from(
    new Set(teamUsers.map((u) => u.department).filter(Boolean))
  ).sort();
  const userDept = (id: string) => state.users.find((u) => u.id === id)?.department;

  const visible = !isAdmin
    ? state.expenses.filter((e) => e.userId === activeUser.id)
    : state.expenses.filter((e) => {
        if (!isSuperAdmin && !teamUsers.some((u) => u.id === e.userId)) return false;
        if (expDept !== 'all' && userDept(e.userId) !== expDept) return false;
        if (expPerson !== 'all' && e.userId !== expPerson) return false;
        return true;
      });

  const submitted = visible.filter((e) => e.status === 'submitted');
  const pendingTotal = submitted.reduce((s, e) => s + e.amount, 0);
  const approvedTotal = visible
    .filter((e) => e.status === 'approved' || e.status === 'reimbursed')
    .reduce((s, e) => s + e.amount, 0);
  const postable = visible.filter(
    (e) => (e.status === 'approved' || e.status === 'reimbursed') && !e.synced
  );

  // Open the camera / file picker to scan a receipt. tripId (optional) ties the
  // resulting expense to a trip.
  const scanReceipt = (tripId = '') => {
    scanTripRef.current = tripId;
    fileRef.current?.click();
  };

  // A receipt was photographed or uploaded: read it, send it for OCR, and
  // autopopulate the form with what came back.
  const onReceiptFile = async (file: File | undefined) => {
    if (!file) return;
    const tripId = scanTripRef.current;
    setOpen(true);
    setScanning(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setReceiptPreview(dataUrl);
      const res = await fetch('/api/expenses/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, filename: file.name }),
      }).then((r) => r.json());
      setForm({
        merchant: res.merchant ?? '',
        category: (res.category as ExpenseCategory) ?? 'Other',
        amount: res.amount != null ? String(res.amount) : '',
        date: res.date ?? todayISO(),
        hasReceipt: true,
        note: '',
        tripId,
      });
    } catch {
      // Keep the form open so the user can enter details manually.
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };


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
      tripId: form.tripId || undefined,
    });
    setForm({
      merchant: '',
      category: 'Meals',
      amount: '',
      date: todayISO(),
      hasReceipt: true,
      note: '',
      tripId: '',
    });
    setReceiptPreview(null);
    setOpen(false);
  };

  return (
    <div>
      {/* Hidden camera / file input for receipt scanning. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onReceiptFile(e.target.files?.[0])}
      />
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

      {/* Smart expense tools. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => scanReceipt()}
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand/40 hover:shadow-sm"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-dark">
            <Receipt className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">Scan a receipt</span>
            <span className="block text-xs text-slate-400">Snap or upload it — we read the details.</span>
          </span>
        </button>
        <button
          onClick={() => setTool('perdiem')}
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand/40 hover:shadow-sm"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-dark">
            <Shield className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-800">Expense policies</span>
            <span className="block text-xs text-slate-400">Daily allowances &amp; limits by city.</span>
          </span>
        </button>
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
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-900">New expense</h2>
            <Button size="sm" variant="outline" onClick={() => scanReceipt()} disabled={scanning}>
              <Receipt className="h-4 w-4" /> Scan receipt
            </Button>
          </div>
          {scanning && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-brand/10 px-3 py-2 text-sm font-medium text-brand-dark">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/40 border-t-brand" />
              Reading your receipt — extracting merchant, amount and category…
            </div>
          )}
          {receiptPreview && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptPreview}
                alt="Receipt"
                className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
              />
              <div className="text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Receipt attached</p>
                <p className="mt-0.5">We read the details below — check them before submitting.</p>
                <button
                  onClick={() => {
                    setReceiptPreview(null);
                    setForm((f) => ({ ...f, hasReceipt: false }));
                  }}
                  className="mt-1 font-medium text-brand-dark hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
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
            <Field label="Trip (optional)">
              <Select
                value={form.tripId}
                onChange={(e) => setForm({ ...form, tripId: e.target.value })}
              >
                <option value="">Not tied to a trip</option>
                {myTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {shortDate(t.startDate)}
                  </option>
                ))}
              </Select>
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

      {isAdmin && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Filter
          </span>
          {isSuperAdmin && (
            <Select value={expDept} onChange={(e) => setExpDept(e.target.value)} className="sm:w-44">
              <option value="all">All sub-teams</option>
              {teamDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          )}
          <Select value={expPerson} onChange={(e) => setExpPerson(e.target.value)} className="sm:w-48">
            <option value="all">Everyone</option>
            {teamUsers
              .filter((u) => expDept === 'all' || u.department === expDept)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
          {(expDept !== 'all' || expPerson !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExpDept('all');
                setExpPerson('all');
              }}
            >
              Clear
            </Button>
          )}
        </div>
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
                        {e.reviewNote && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            <span className="font-semibold">
                              {e.status === 'rejected' ? 'Rejected' : 'Approved'}:
                            </span>{' '}
                            {e.reviewNote}
                          </p>
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
                                onClick={() => {
                                  setDecideNote('');
                                  setDecide({ id: e.id, kind: 'approved' });
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setDecideNote('');
                                  setDecide({ id: e.id, kind: 'rejected' });
                                }}
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

      {tool === 'perdiem' && <PerDiemModal onClose={() => setTool(null)} />}

      {/* approve / reject with a comment */}
      {decide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
          onClick={() => setDecide(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {decide.kind === 'approved' ? 'Approve expense' : 'Reject expense'}
              </h2>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block text-sm font-medium text-slate-700">
                Comment to the employee{' '}
                {decide.kind === 'rejected' ? (
                  <span className="text-red-500">*</span>
                ) : (
                  '(optional)'
                )}
              </label>
              <textarea
                value={decideNote}
                onChange={(ev) => setDecideNote(ev.target.value)}
                rows={3}
                autoFocus
                placeholder={
                  decide.kind === 'rejected'
                    ? 'Let them know why, and what to fix…'
                    : 'Optional note…'
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button variant="ghost" onClick={() => setDecide(null)}>
                Cancel
              </Button>
              <Button
                variant={decide.kind === 'rejected' ? 'danger' : 'primary'}
                disabled={decide.kind === 'rejected' && !decideNote.trim()}
                onClick={() => {
                  if (decide.kind === 'rejected' && !decideNote.trim()) return;
                  setExpenseStatus(decide.id, decide.kind, decideNote.trim() || undefined);
                  setDecide(null);
                }}
              >
                {decide.kind === 'approved' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function PerDiemModal({ onClose }: { onClose: () => void }) {
  const [days, setDays] = useState('3');
  const [tier, setTier] = useState<'standard' | 'high'>('standard');
  const meals = tier === 'high' ? 95 : 65;
  const lodging = tier === 'high' ? 300 : 180;
  const incidentals = 15;
  const perDay = meals + lodging + incidentals;
  const total = perDay * (Number(days) || 0);
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="font-display text-lg font-bold text-slate-900">Expense policies</h2>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nights">
            <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <Field label="City tier">
            <Select value={tier} onChange={(e) => setTier(e.target.value as 'standard' | 'high')}>
              <option value="standard">Standard</option>
              <option value="high">High-cost</option>
            </Select>
          </Field>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Meals / day</span><span>{money(meals)}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-slate-500">Lodging / day</span><span>{money(lodging)}</span></div>
          <div className="mt-1 flex justify-between"><span className="text-slate-500">Incidentals / day</span><span>{money(incidentals)}</span></div>
          <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-800">
            <span>Allowance</span>
            <span className="font-display text-lg">{money(total)}</span>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Allowances follow your policy tiers; anything over is flagged for approval automatically.
        </p>
      </div>
    </Overlay>
  );
}
