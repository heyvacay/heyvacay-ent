'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCrm } from '@/lib/crmStore';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  cn,
} from '@/components/app/ui';
import { money, shortDate, todayISO } from '@/lib/format';
import {
  CONTRACT_STATUS_COLOR,
  CONTRACT_STATUS_LABEL,
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  ME,
  REPS,
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_ORDER,
  TASK_LABEL,
  healthColor,
  nextBestAction,
  onboardingPct,
  type AccountStatus,
  type ContractStatus,
  type DealStage,
  type TaskType,
} from '@/lib/crm';
import { accountOnePagerPdf, contractPdf } from '@/lib/pdf';
import { useAppLink } from '@/lib/appLink';
import { ContractWizard } from '@/components/sales/ContractWizard';
import {
  Check,
  Building,
  ArrowRight,
  Sparkles,
  Receipt,
} from '@/components/icons';

type Tab = 'overview' | 'deals' | 'contracts' | 'tasks' | 'notes';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'deals', label: 'Deals' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
];

export default function CompanyDetail({ id }: { id: string }) {
  const {
    companyById,
    setStatus,
    assignManager,
    updateCompany,
    toggleStep,
    addDeal,
    moveDeal,
    addTask,
    toggleTask,
    setContractStatus,
    addNote,
  } = useCrm();
  const router = useRouter();
  const c = companyById(id);
  // Live stats from the customer workspace when this account is provisioned
  // in this browser (ids match). Null otherwise.
  const linked = useAppLink(id);

  const [tab, setTab] = useState<Tab>('overview');
  const [wizard, setWizard] = useState(false);

  if (!c) {
    return (
      <div>
        <Link href="/sales/companies" className="text-sm font-medium text-brand-dark hover:underline">
          ← All companies
        </Link>
        <div className="mt-4">
          <EmptyState title="Company not found" sub="It may have been removed." />
        </div>
      </div>
    );
  }

  const enterAccount = () => {
    try {
      sessionStorage.setItem('hv_view_as', c.name);
      sessionStorage.setItem(
        'hv_view_as_ctx',
        JSON.stringify({ id: c.id, name: c.name, domain: c.domain })
      );
      window.dispatchEvent(new Event('hv-view-as-change'));
    } catch {
      /* ignore */
    }
    router.push('/app');
  };

  const pct = onboardingPct(c);

  return (
    <div>
      <Link href="/sales/companies" className="text-sm font-medium text-brand-dark hover:underline">
        ← All companies
      </Link>

      <PageHeader
        title={c.name}
        subtitle={`${c.industry} · ${c.tier} · ${c.employees} employees · ${c.hq || '—'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => accountOnePagerPdf(c)}>
              <Receipt className="h-4 w-4" /> Account brief PDF
            </Button>
            <Button onClick={enterAccount}>
              Enter account <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* tabs */}
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                )}
              >
                {t.label}
                {t.key === 'deals' && c.deals.length > 0 && ` (${c.deals.length})`}
                {t.key === 'contracts' && c.contracts.length > 0 && ` (${c.contracts.length})`}
                {t.key === 'tasks' && c.tasks.filter((x) => !x.done).length > 0 && ` (${c.tasks.filter((x) => !x.done).length})`}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <>
              {/* Nova insight */}
              <Card className="border-brand/30 bg-brand/5">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Sparkles className="h-4 w-4 text-brand-dark" /> Nova suggests
                </p>
                <p className="mt-1 text-sm text-slate-600">{nextBestAction(c, todayISO())}</p>
              </Card>

              {/* snapshot */}
              <Card>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Metric
                    label="Annual spend"
                    value={money(linked ? linked.spend : c.annualSpend)}
                  />
                  <Metric
                    label="Saved"
                    value={money(linked ? linked.savings : c.savings)}
                    tone="emerald"
                  />
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <Badge color={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Health</p>
                    <Badge color={healthColor(c.health)}>{c.health}/100</Badge>
                  </div>
                </div>
              </Card>

              {/* live workspace data */}
              {linked && (
                <Card className="border-emerald-200 bg-emerald-50/40">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
                      <Sparkles className="h-4 w-4 text-emerald-600" /> Live from their workspace
                    </h2>
                    <Badge color="green">Connected</Badge>
                  </div>
                  <div className="mb-4 grid grid-cols-3 gap-4">
                    <Metric label="Bookings" value={String(linked.bookings)} />
                    <Metric label="Spend" value={money(linked.spend)} />
                    <Metric label="Saved" value={money(linked.savings)} tone="emerald" />
                  </div>
                  {linked.recent.length > 0 ? (
                    <div className="space-y-1.5">
                      {linked.recent.map((b, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                          <span className="min-w-0 truncate text-slate-700">{b.title}</span>
                          <span className="shrink-0 text-xs text-slate-400">
                            {money(b.price)}
                            {b.savings > 0 && <span className="ml-2 text-emerald-600">saved {money(b.savings)}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No bookings in their workspace yet.</p>
                  )}
                </Card>
              )}

              {/* onboarding */}
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-slate-900">Onboarding</h2>
                  <span className="text-sm font-semibold text-slate-500">{pct}% complete</span>
                </div>
                <div className="mb-4">
                  <ProgressBar value={pct} max={100} />
                </div>
                <div className="space-y-2">
                  {c.onboarding.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => toggleStep(c.id, s.key)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-slate-300"
                    >
                      <span
                        className={cn(
                          'grid h-6 w-6 shrink-0 place-items-center rounded-full',
                          s.done ? 'bg-brand text-navy-deep' : 'bg-slate-100 text-slate-300'
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span
                        className={cn(
                          'text-sm',
                          s.done ? 'font-medium text-slate-500 line-through' : 'text-slate-700'
                        )}
                      >
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>

              {/* contacts */}
              <Card>
                <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Contacts</h2>
                {c.contacts.length === 0 ? (
                  <p className="text-sm text-slate-400">No contacts yet.</p>
                ) : (
                  <div className="space-y-2">
                    {c.contacts.map((p) => (
                      <div
                        key={p.email}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                          {p.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {p.name}
                            {p.champion && (
                              <span className="ml-2 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-dark">
                                Champion
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {p.title} · {p.email}
                            {p.phone ? ` · ${p.phone}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}

          {tab === 'deals' && <DealsTab company={c} addDeal={addDeal} moveDeal={moveDeal} />}
          {tab === 'contracts' && (
            <ContractsTab
              company={c}
              onGenerate={() => setWizard(true)}
              setContractStatus={setContractStatus}
            />
          )}
          {tab === 'tasks' && <TasksTab company={c} addTask={addTask} toggleTask={toggleTask} />}
          {tab === 'notes' && <NotesTab company={c} addNote={addNote} />}
        </div>

        {/* rail */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Account</h2>
            <label className="mb-1 block text-xs font-medium text-slate-500">Account manager</label>
            <div className="flex items-center gap-2">
              <span className="flex-1">
                <Select
                  value={c.accountManager ?? ''}
                  onChange={(e) => assignManager(c.id, e.target.value || undefined)}
                >
                  <option value="">Unassigned</option>
                  {REPS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </span>
              {c.accountManager !== ME && (
                <Button size="sm" variant="outline" onClick={() => assignManager(c.id, ME)}>
                  Claim
                </Button>
              )}
            </div>

            <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">Status</label>
            <Select
              value={c.status}
              onChange={(e) => setStatus(c.id, e.target.value as AccountStatus)}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>

            <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">Next step</label>
            <Input
              value={c.nextStep ?? ''}
              onChange={(e) => updateCompany(c.id, { nextStep: e.target.value })}
              placeholder="What moves this forward?"
            />

            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Building className="h-4 w-4 text-brand-dark" /> Enter their account
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Drop into {c.name}&apos;s workspace to set things up or troubleshoot as the
                customer sees it.
              </p>
              <Button size="sm" className="mt-2 w-full" onClick={enterAccount}>
                Open their workspace
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Activity</h2>
            </div>
            <div className="space-y-3">
              {c.activity.map((a, i) => (
                <div key={i} className="border-l-2 border-brand/40 pl-3">
                  <p className="text-sm text-slate-700">{a.text}</p>
                  <p className="text-xs text-slate-400">{shortDate(a.date)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {wizard && <ContractWizard company={c} onClose={() => setWizard(false)} />}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'emerald';
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={cn(
          'font-display text-lg font-bold',
          tone === 'emerald' ? 'text-emerald-600' : 'text-slate-900'
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* ---------------- deals tab ---------------- */

function DealsTab({
  company: c,
  addDeal,
  moveDeal,
}: {
  company: ReturnType<typeof useCrm>['companies'][number];
  addDeal: ReturnType<typeof useCrm>['addDeal'];
  moveDeal: ReturnType<typeof useCrm>['moveDeal'];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: `${c.name} — expansion`,
    value: Math.round(c.annualSpend * 0.25),
    stage: 'qualify' as DealStage,
    closeDate: todayISO(),
  });

  const create = () => {
    if (!form.name.trim()) return;
    addDeal(c.id, { ...form, value: Number(form.value) || 0 });
    setOpen(false);
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-slate-900">Deals</h2>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'New deal'}
        </Button>
      </div>

      {open && (
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
          <Field label="Deal name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Value (ACV)">
            <Input
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            />
          </Field>
          <Field label="Stage">
            <Select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value as DealStage })}
            >
              {DEAL_STAGES.map((s) => (
                <option key={s} value={s}>
                  {DEAL_STAGE_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expected close">
            <Input
              type="date"
              value={form.closeDate}
              onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button size="sm" onClick={create}>
              Add deal
            </Button>
          </div>
        </div>
      )}

      {c.deals.length === 0 ? (
        <p className="text-sm text-slate-400">No deals yet.</p>
      ) : (
        <div className="space-y-2">
          {c.deals.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{d.name}</p>
                <p className="text-xs text-slate-400">
                  {money(d.value)} · {d.probability}% · close {shortDate(d.closeDate)}
                </p>
              </div>
              <div className="w-full sm:w-44">
                <Select
                  value={d.stage}
                  onChange={(e) => moveDeal(c.id, d.id, e.target.value as DealStage)}
                >
                  {DEAL_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {DEAL_STAGE_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------------- contracts tab ---------------- */

function ContractsTab({
  company: c,
  onGenerate,
  setContractStatus,
}: {
  company: ReturnType<typeof useCrm>['companies'][number];
  onGenerate: () => void;
  setContractStatus: ReturnType<typeof useCrm>['setContractStatus'];
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-slate-900">Contracts</h2>
        <Button size="sm" onClick={onGenerate}>
          <Sparkles className="h-4 w-4" /> Generate contract
        </Button>
      </div>

      {c.contracts.length === 0 ? (
        <EmptyState
          title="No contracts yet"
          sub="Generate one — Nova asks a few questions and builds a signed-ready PDF."
        />
      ) : (
        <div className="space-y-2">
          {c.contracts.map((ct) => (
            <div key={ct.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{ct.title}</p>
                  <p className="text-xs text-slate-400">
                    {money(ct.value)} ACV · {ct.terms.termMonths}mo · created {shortDate(ct.createdAt)}
                  </p>
                </div>
                <Badge color={CONTRACT_STATUS_COLOR[ct.status]}>
                  {CONTRACT_STATUS_LABEL[ct.status]}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => contractPdf(c, ct)}>
                  <Receipt className="h-4 w-4" /> Download PDF
                </Button>
                <span className="w-40">
                  <Select
                    value={ct.status}
                    onChange={(e) =>
                      setContractStatus(c.id, ct.id, e.target.value as ContractStatus)
                    }
                  >
                    {(['draft', 'sent', 'signed'] as ContractStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {CONTRACT_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------------- tasks tab ---------------- */

function TasksTab({
  company: c,
  addTask,
  toggleTask,
}: {
  company: ReturnType<typeof useCrm>['companies'][number];
  addTask: ReturnType<typeof useCrm>['addTask'];
  toggleTask: ReturnType<typeof useCrm>['toggleTask'];
}) {
  const [form, setForm] = useState({
    title: '',
    type: 'call' as TaskType,
    due: todayISO(),
  });
  const create = () => {
    if (!form.title.trim()) return;
    addTask(c.id, form);
    setForm({ title: '', type: 'call', due: todayISO() });
  };

  const open = c.tasks.filter((t) => !t.done);
  const done = c.tasks.filter((t) => t.done);

  return (
    <Card>
      <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Tasks</h2>

      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Add a task…"
        />
        <Select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}
        >
          {(Object.keys(TASK_LABEL) as TaskType[]).map((t) => (
            <option key={t} value={t}>
              {TASK_LABEL[t]}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={form.due}
          onChange={(e) => setForm({ ...form, due: e.target.value })}
        />
        <Button size="sm" onClick={create}>
          Add
        </Button>
      </div>

      {c.tasks.length === 0 ? (
        <p className="text-sm text-slate-400">No tasks yet.</p>
      ) : (
        <div className="space-y-2">
          {[...open, ...done].map((t) => {
            const overdue = !t.done && t.due < todayISO();
            return (
              <button
                key={t.id}
                onClick={() => toggleTask(c.id, t.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-slate-300"
              >
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                    t.done ? 'border-brand bg-brand text-navy-deep' : 'border-slate-300'
                  )}
                >
                  {t.done && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-sm',
                      t.done ? 'text-slate-400 line-through' : 'text-slate-700'
                    )}
                  >
                    {t.title}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {TASK_LABEL[t.type]} · due {shortDate(t.due)}
                  </span>
                </span>
                {overdue && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                    Overdue
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ---------------- notes tab ---------------- */

function NotesTab({
  company: c,
  addNote,
}: {
  company: ReturnType<typeof useCrm>['companies'][number];
  addNote: ReturnType<typeof useCrm>['addNote'];
}) {
  const [text, setText] = useState('');
  const save = () => {
    if (!text.trim()) return;
    addNote(c.id, text.trim());
    setText('');
  };

  return (
    <Card>
      <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Notes</h2>
      <div className="mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Log a call summary, objection, or next step…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-slate-400"
        />
        <div className="mt-2 text-right">
          <Button size="sm" onClick={save} disabled={!text.trim()}>
            Save note
          </Button>
        </div>
      </div>
      {c.notes.length === 0 ? (
        <p className="text-sm text-slate-400">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {c.notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-700">{n.text}</p>
              <p className="mt-1 text-xs text-slate-400">
                {n.author} · {shortDate(n.date)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
