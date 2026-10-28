'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCrm } from '@/lib/crmStore';
import {
  Badge,
  Button,
  Field,
  Input,
  PageHeader,
  Select,
  cn,
} from '@/components/app/ui';
import { money } from '@/lib/format';
import { companyAccountNumber } from '@/components/app/AppShell';
import {
  INDUSTRIES,
  ME,
  REPS,
  STATUS_COLOR,
  STATUS_LABEL,
  STATUS_ORDER,
  TIERS,
  healthColor,
  onboardingPct,
  type AccountStatus,
  type Contact,
  type Tier,
} from '@/lib/crm';
import { ArrowRight, Building, Check, Globe, Users } from '@/components/icons';

type Draft = {
  name: string;
  domain: string;
  website: string;
  industry: string;
  tier: Tier;
  employees: number;
  hq: string;
  annualSpend: number;
  accountManager: string;
  contacts: Contact[];
  domainJoin: boolean;
};

const BLANK: Draft = {
  name: '',
  domain: '',
  website: '',
  industry: INDUSTRIES[0] as string,
  tier: 'Mid-Market',
  employees: 100,
  hq: '',
  annualSpend: 500000,
  accountManager: ME,
  contacts: [],
  domainJoin: false,
};

const WIZARD = [
  { key: 'company', label: 'Company', icon: Building },
  { key: 'contacts', label: 'Points of contact', icon: Users },
  { key: 'access', label: 'Commercials & access', icon: Globe },
] as const;

export default function CompaniesPage() {
  const { companies, addCompany } = useCrm();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | AccountStatus>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const shown = companies
    .filter((c) => (filter === 'all' ? true : c.status === filter))
    .filter((c) =>
      q
        ? [c.name, c.domain, c.industry, c.hq, companyAccountNumber(c.id)].some((f) =>
            f?.toLowerCase().includes(q)
          )
        : true
    );

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="Every account in the book — create, assign, and onboard."
        actions={<Button onClick={() => setOpen(true)}>New company</Button>}
      />

      {/* filter tabs + search */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {(['all', ...STATUS_ORDER] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors',
                filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              )}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-64">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, domain, account #…"
          />
        </div>
      </div>

      <div className="space-y-2">
        {shown.map((c) => (
          <Link
            key={c.id}
            href={`/sales/companies/${c.id}`}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 sm:flex-row sm:items-center"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              {c.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-800">{c.name}</p>
                <Badge color={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                {c.domainJoin && c.domain && (
                  <Badge color="brand">@{c.domain} auto-join</Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {c.industry} · {c.employees} employees · {c.hq || '—'}
              </p>
              <p className="font-mono text-[11px] text-slate-400">{companyAccountNumber(c.id)}</p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <p className="font-semibold text-slate-900">{money(c.annualSpend)}</p>
                <p className="text-xs text-slate-400">annual spend</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="font-semibold text-emerald-600">{money(c.savings)}</p>
                <p className="text-xs text-slate-400">saved</p>
              </div>
              <div className="hidden w-28 text-right sm:block">
                <p className="text-xs font-medium text-slate-500">
                  {c.accountManager ?? 'Unassigned'}
                </p>
                <p className="mt-0.5">
                  <Badge color={healthColor(c.health)}>Health {c.health}</Badge>
                </p>
                {c.status === 'onboarding' && (
                  <p className="mt-0.5 text-xs text-amber-600">{onboardingPct(c)}% onboarded</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {open && (
        <NewCompanyWizard
          onClose={() => setOpen(false)}
          onCreate={(draft) => {
            const co = addCompany({
              name: draft.name.trim(),
              domain: draft.domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
              website: draft.website.trim() || undefined,
              industry: draft.industry,
              tier: draft.tier,
              employees: Number(draft.employees) || 0,
              hq: draft.hq.trim(),
              annualSpend: Number(draft.annualSpend) || 0,
              accountManager: draft.accountManager || undefined,
              contacts: draft.contacts,
              domainJoin: draft.domainJoin,
            });
            setOpen(false);
            router.push(`/sales/companies/${co.id}`);
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------- creation wizard ----------------------------- */

function NewCompanyWizard({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (draft: Draft) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Draft>(BLANK);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [contact, setContact] = useState<Contact>({
    name: '',
    title: '',
    email: '',
    phone: '',
    champion: false,
  });

  const key = WIZARD[step].key;
  const pct = Math.round(((step + 1) / WIZARD.length) * 100);

  const canContinue = () => {
    if (key === 'company') return form.name.trim().length > 1;
    return true;
  };
  const isLast = step === WIZARD.length - 1;

  const addContact = () => {
    if (!contact.name.trim() || !contact.email.trim()) return;
    set('contacts', [...form.contacts, { ...contact, name: contact.name.trim() }]);
    setContact({ name: '', title: '', email: '', phone: '', champion: false });
  };
  const removeContact = (i: number) =>
    set('contacts', form.contacts.filter((_, idx) => idx !== i));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header + progress */}
        <div className="border-b border-slate-100 px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">New company</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {WIZARD.map((w, i) => {
              const WIcon = w.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={w.key} className="flex flex-1 items-center gap-2">
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs transition-colors',
                      done
                        ? 'bg-brand text-navy-deep'
                        : active
                          ? 'bg-brand/20 text-brand-dark ring-1 ring-brand/40'
                          : 'bg-slate-100 text-slate-400'
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <WIcon className="h-3.5 w-3.5" />}
                  </span>
                  <span
                    className={cn(
                      'hidden text-xs font-semibold sm:block',
                      active ? 'text-slate-900' : 'text-slate-400'
                    )}
                  >
                    {w.label}
                  </span>
                  {i < WIZARD.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {key === 'company' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Company name">
                  <Input
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Acme Inc."
                    autoFocus
                  />
                </Field>
              </div>
              <Field label="Email domain">
                <Input
                  value={form.domain}
                  onChange={(e) => set('domain', e.target.value)}
                  placeholder="acme.com"
                />
              </Field>
              <Field label="Website">
                <Input
                  value={form.website}
                  onChange={(e) => set('website', e.target.value)}
                  placeholder="https://acme.com"
                />
              </Field>
              <Field label="Industry">
                <Select
                  value={form.industry}
                  onChange={(e) => set('industry', e.target.value)}
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tier">
                <Select value={form.tier} onChange={(e) => set('tier', e.target.value as Tier)}>
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Employees">
                <Input
                  type="number"
                  value={form.employees}
                  onChange={(e) => set('employees', Number(e.target.value))}
                />
              </Field>
              <Field label="Headquarters">
                <Input
                  value={form.hq}
                  onChange={(e) => set('hq', e.target.value)}
                  placeholder="City, Country"
                />
              </Field>
            </div>
          )}

          {key === 'contacts' && (
            <div>
              <p className="text-sm text-slate-500">
                Who are the account reps — your points of contact at{' '}
                <span className="font-semibold text-slate-700">
                  {form.name.trim() || 'this company'}
                </span>
                ? Add the champion and anyone else you&apos;ll work with. Mark the
                primary decision-maker as the champion.
              </p>

              {/* existing contacts */}
              {form.contacts.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {form.contacts.map((c, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                        {c.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                          {c.name}
                          {c.champion && <Badge color="brand">Champion</Badge>}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {[c.title, c.email, c.phone].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <button
                        onClick={() => removeContact(i)}
                        aria-label="Remove contact"
                        className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* adder */}
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input
                      value={contact.name}
                      onChange={(e) => setContact({ ...contact, name: e.target.value })}
                      placeholder="Jane Doe"
                    />
                  </Field>
                  <Field label="Title">
                    <Input
                      value={contact.title}
                      onChange={(e) => setContact({ ...contact, title: e.target.value })}
                      placeholder="VP Finance"
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                      placeholder="jane@acme.com"
                    />
                  </Field>
                  <Field label="Phone (optional)">
                    <Input
                      value={contact.phone ?? ''}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      placeholder="+1 555 123 4567"
                    />
                  </Field>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={!!contact.champion}
                      onChange={(e) => setContact({ ...contact, champion: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    Champion (primary decision-maker)
                  </label>
                  <Button
                    variant="ghost"
                    onClick={addContact}
                    disabled={!contact.name.trim() || !contact.email.trim()}
                  >
                    + Add contact
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                You can add, edit or remove contacts anytime from the company profile.
              </p>
            </div>
          )}

          {key === 'access' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Est. annual travel spend">
                  <Input
                    type="number"
                    value={form.annualSpend}
                    onChange={(e) => set('annualSpend', Number(e.target.value))}
                  />
                </Field>
                <Field label="Account manager">
                  <Select
                    value={form.accountManager}
                    onChange={(e) => set('accountManager', e.target.value)}
                  >
                    {REPS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* domain self-join */}
              <div
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  form.domainJoin
                    ? 'border-brand/40 bg-brand/8'
                    : 'border-slate-200 bg-slate-50'
                )}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.domainJoin}
                    onChange={(e) => set('domainJoin', e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span className="text-sm">
                    <span className="font-semibold text-slate-800">
                      Enable domain self-join
                    </span>
                    <span className="mt-1 block text-slate-500">
                      Anyone who signs up and verifies a work email on{' '}
                      <span className="font-mono text-slate-700">
                        @{form.domain.trim() || 'company.com'}
                      </span>{' '}
                      is automatically added to this workspace with the lowest
                      (traveler) role — no invite needed.
                    </span>
                  </span>
                </label>
                {form.domainJoin && !form.domain.trim() && (
                  <p className="mt-2 pl-7 text-xs font-medium text-amber-600">
                    Add an email domain on step 1 for self-join to work.
                  </p>
                )}
              </div>

              {/* summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Review
                </p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <Row k="Company" v={form.name.trim() || '—'} />
                  <Row k="Domain" v={form.domain.trim() || '—'} />
                  <Row k="Tier" v={form.tier} />
                  <Row
                    k="Points of contact"
                    v={
                      form.contacts.length
                        ? `${form.contacts.length} added`
                        : 'None yet'
                    }
                  />
                  <Row k="Account manager" v={form.accountManager || 'Unassigned'} />
                  <Row k="Domain self-join" v={form.domainJoin ? 'On' : 'Off'} />
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <div className="text-xs font-medium text-slate-400">{pct}% complete</div>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            )}
            {isLast ? (
              <Button onClick={() => onCreate(form)} disabled={!form.name.trim()}>
                Create company
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue()}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-medium text-slate-800">{v}</dd>
    </div>
  );
}
