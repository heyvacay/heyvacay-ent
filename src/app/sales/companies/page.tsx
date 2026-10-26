'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCrm } from '@/lib/crmStore';
import {
  Badge,
  Button,
  Card,
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
  type Tier,
} from '@/lib/crm';

export default function CompaniesPage() {
  const { companies, addCompany } = useCrm();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | AccountStatus>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    domain: '',
    industry: INDUSTRIES[0] as string,
    tier: 'Mid-Market' as Tier,
    employees: 100,
    hq: '',
    annualSpend: 500000,
    accountManager: ME,
  });

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

  const create = () => {
    if (!form.name.trim()) return;
    const co = addCompany({
      name: form.name.trim(),
      domain: form.domain.trim(),
      industry: form.industry,
      tier: form.tier,
      employees: Number(form.employees) || 0,
      hq: form.hq.trim(),
      annualSpend: Number(form.annualSpend) || 0,
      accountManager: form.accountManager || undefined,
    });
    setOpen(false);
    router.push(`/sales/companies/${co.id}`);
  };

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

      {/* create modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-bold text-slate-900">New company</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <Field label="Company name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Acme Inc."
                  autoFocus
                />
              </Field>
              <Field label="Domain">
                <Input
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="acme.com"
                />
              </Field>
              <Field label="Industry">
                <Select
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tier">
                <Select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as Tier })}
                >
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
                  onChange={(e) => setForm({ ...form, employees: Number(e.target.value) })}
                />
              </Field>
              <Field label="Headquarters">
                <Input
                  value={form.hq}
                  onChange={(e) => setForm({ ...form, hq: e.target.value })}
                  placeholder="City, Country"
                />
              </Field>
              <Field label="Est. annual travel spend">
                <Input
                  type="number"
                  value={form.annualSpend}
                  onChange={(e) => setForm({ ...form, annualSpend: Number(e.target.value) })}
                />
              </Field>
              <Field label="Account manager">
                <Select
                  value={form.accountManager}
                  onChange={(e) => setForm({ ...form, accountManager: e.target.value })}
                >
                  {REPS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create} disabled={!form.name.trim()}>
                Create company
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
