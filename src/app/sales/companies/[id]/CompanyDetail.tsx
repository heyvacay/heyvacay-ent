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
  REP_COMMISSION_DOWN,
  REP_COMMISSION_UP,
  type AccountStatus,
  type ContractStatus,
  type DealStage,
  type TaskType,
  type SalesCompany,
  type CommissionApproval,
  type RepRole,
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

type Tab = 'overview' | 'deals' | 'contracts' | 'commission' | 'tasks' | 'notes';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'deals', label: 'Deals' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'commission', label: 'Commission' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'notes', label: 'Notes' },
];
const COMMISSION_STARS = [5, 4, 3, 2, 1, 0];

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
    addContact,
    viewerRole,
    provisionAccount,
    globalStarRate,
    setCompanyCustomCommission,
    setCompanyStarRate,
    commissionApprovals,
  } = useCrm();
  const router = useRouter();
  const [provisionPrompt, setProvisionPrompt] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    champion: false,
  });
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

  // Drop into the customer's workspace as their account manager.
  const openWorkspace = () => {
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

  // A lead has no account yet — prompt the rep to create one first. Anything
  // past "lead" already has a workspace, so enter it directly.
  const enterAccount = () => {
    if (c.status === 'lead') {
      setProvisionPrompt(true);
      return;
    }
    openWorkspace();
  };

  const createAccountAndEnter = () => {
    provisionAccount(c.id);
    setProvisionPrompt(false);
    openWorkspace();
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
              {c.status === 'lead' ? 'Create account' : 'Enter account'}{' '}
              <ArrowRight className="h-4 w-4" />
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
              {/* Net 30 request from the customer */}
              {linked?.netRequested && (
                <Card className="border-amber-300 bg-amber-50">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <Receipt className="h-4 w-4" /> 1 Net 30 request
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    {c.name} asked to set up Net 30 terms. As the account manager
                    {c.accountManager ? ` (${c.accountManager})` : ''}, reach out to approve and
                    configure invoicing.
                  </p>
                </Card>
              )}

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
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold text-slate-900">Contacts</h2>
                  <Button size="sm" variant="outline" onClick={() => setShowContactForm((v) => !v)}>
                    {showContactForm ? 'Close' : '+ Add contact'}
                  </Button>
                </div>
                {showContactForm && (
                  <div className="mb-3 rounded-xl border border-dashed border-slate-300 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        placeholder="Name"
                      />
                      <Input
                        value={contactForm.title}
                        onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                        placeholder="Title"
                      />
                      <Input
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        placeholder="Email"
                      />
                      <Input
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        placeholder="Phone (optional)"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={contactForm.champion}
                          onChange={(e) => setContactForm({ ...contactForm, champion: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                        />
                        Champion (primary contact)
                      </label>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!contactForm.name.trim() || !contactForm.email.trim()) return;
                          addContact(c.id, {
                            name: contactForm.name.trim(),
                            title: contactForm.title.trim(),
                            email: contactForm.email.trim(),
                            phone: contactForm.phone.trim() || undefined,
                            champion: contactForm.champion,
                          });
                          setContactForm({ name: '', title: '', email: '', phone: '', champion: false });
                          setShowContactForm(false);
                        }}
                        disabled={!contactForm.name.trim() || !contactForm.email.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}
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
          {tab === 'commission' && (
            <CommissionTab
              company={c}
              viewerRole={viewerRole}
              globalStarRate={globalStarRate}
              setCompanyCustomCommission={setCompanyCustomCommission}
              setCompanyStarRate={setCompanyStarRate}
              pending={commissionApprovals.filter(
                (a) => a.companyId === c.id && a.status === 'pending'
              )}
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
                <Building className="h-4 w-4 text-brand-dark" />{' '}
                {c.status === 'lead' ? 'Create their account' : 'Enter their account'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {c.status === 'lead'
                  ? `${c.name} is still a lead — no workspace exists yet. Create the account to drop in as their account manager.`
                  : `Drop into ${c.name}'s workspace to set things up or troubleshoot as the customer sees it.`}
              </p>
              <Button size="sm" className="mt-2 w-full" onClick={enterAccount}>
                {c.status === 'lead' ? 'Create account' : 'Open their workspace'}
              </Button>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-slate-700">Domain self-join</p>
              <label className="mb-1 mt-2 block text-xs font-medium text-slate-500">
                Email domain
              </label>
              <Input
                value={c.domain ?? ''}
                onChange={(e) =>
                  updateCompany(c.id, {
                    domain: e.target.value.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
                  })
                }
                placeholder="acme.com"
              />
              <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={!!c.domainJoin}
                  onChange={(e) => updateCompany(c.id, { domainJoin: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span className="text-xs text-slate-500">
                  Auto-join verified{' '}
                  <span className="font-mono text-slate-700">@{c.domain || 'company.com'}</span>{' '}
                  emails with the lowest (traveler) role.
                </span>
              </label>
              {c.domainJoin && (
                <p className="mt-2 rounded-lg bg-brand/10 px-2.5 py-1.5 text-[11px] text-brand-dark">
                  Self-join is on — new {c.domain ? `@${c.domain}` : 'domain'} users land in
                  this workspace automatically once their email is verified.
                </p>
              )}
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

      {provisionPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setProvisionPrompt(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold text-slate-900">Create account?</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{c.name}</span> is still a lead, so no
              workspace has been created yet. Creating the account will move it into onboarding and
              open a fresh workspace you can set up on their behalf.
            </p>
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Account manager will be set to{' '}
              <span className="font-semibold text-slate-700">{c.accountManager ?? 'you'}</span>. You
              can invite their team and configure policies once inside.
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setProvisionPrompt(false)}>
                Cancel
              </Button>
              <Button onClick={createAccountAndEnter}>
                Create account &amp; enter <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

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

function CommissionTab({
  company,
  viewerRole,
  globalStarRate,
  setCompanyCustomCommission,
  setCompanyStarRate,
  pending,
}: {
  company: SalesCompany;
  viewerRole: RepRole;
  globalStarRate: (star: number) => number;
  setCompanyCustomCommission: (id: string, on: boolean) => void;
  setCompanyStarRate: (id: string, star: number, pct: number) => 'applied' | 'approval_requested';
  pending: CommissionApproval[];
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const on = !!company.customCommission;
  const isCSuite = viewerRole === 'C-Suite';

  return (
    <div className="max-w-2xl space-y-5">
      <Card>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => setCompanyCustomCommission(company.id, e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          <span>
            <span className="block font-semibold text-slate-800">
              Custom commission for {company.name}
            </span>
            <span className="block text-sm text-slate-400">
              When on, this account uses its own star-tier rates and is excluded from global
              commission changes.
            </span>
          </span>
        </label>

        {on && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-3 text-sm text-slate-500">
              {isCSuite
                ? 'As C-Suite you can set any rate.'
                : `Reps can move each rate from −${REP_COMMISSION_DOWN}% to +${REP_COMMISSION_UP}% of the global rate; beyond that it's sent to C-Suite for approval.`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {COMMISSION_STARS.map((s) => {
                const g = globalStarRate(s);
                const val = company.commissionStars?.[String(s)] ?? g;
                return (
                  <StarRateInput
                    key={s}
                    label={s === 0 ? '0★ (unrated)' : `${s}★`}
                    global={g}
                    value={val}
                    onSave={(p) => {
                      const r = setCompanyStarRate(company.id, s, p);
                      setFlash(
                        r === 'approval_requested'
                          ? `${s}★ → ${p}% is outside the rep band — sent to C-Suite for approval.`
                          : `${s}★ set to ${p}%.`
                      );
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {flash && (
          <p className="mt-4 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">{flash}</p>
        )}
      </Card>

      {pending.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <h3 className="font-display text-sm font-bold text-slate-900">Pending C-Suite approval</h3>
          <div className="mt-2 space-y-1.5">
            {pending.map((a) => (
              <p key={a.id} className="text-sm text-slate-700">
                {a.starRating}★ → <span className="font-semibold">{a.toPercent}%</span>{' '}
                <span className="text-slate-400">
                  (global {a.globalPercent}%, requested by {a.requestedBy})
                </span>
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StarRateInput({
  label,
  global,
  value,
  onSave,
}: {
  label: string;
  global: number;
  value: number;
  onSave: (pct: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-amber-500">{label}</span>
        <span className="text-xs text-slate-400">global {global}%</span>
      </div>
      <div className="relative mt-2">
        <input
          type="number"
          step="0.5"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Number(draft);
            if (Number.isFinite(n) && n >= 0 && n <= 100 && n !== value) onSave(n);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-7 text-right text-sm font-semibold text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          %
        </span>
      </div>
    </div>
  );
}
