'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCrm } from '@/lib/crmStore';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  cn,
} from '@/components/app/ui';
import { money, shortDate } from '@/lib/format';
import {
  ME,
  REPS,
  STATUS_LABEL,
  STATUS_ORDER,
  onboardingPct,
  type AccountStatus,
} from '@/lib/crm';
import { Check, Building, ArrowRight } from '@/components/icons';

const STATUS_COLOR: Record<AccountStatus, 'slate' | 'amber' | 'green' | 'red'> = {
  lead: 'slate',
  onboarding: 'amber',
  active: 'green',
  churned: 'red',
};

export default function CompanyDetail({ id }: { id: string }) {
  const { companyById, setStatus, assignManager, toggleStep } = useCrm();
  const router = useRouter();
  const c = companyById(id);

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

  const viewAsUser = () => {
    try {
      sessionStorage.setItem('hv_view_as', c.name);
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
        subtitle={`${c.domain} · ${c.employees} employees · ${c.hq || '—'}`}
        actions={
          <Button onClick={viewAsUser}>
            View as user <ArrowRight className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* snapshot */}
          <Card>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Annual spend</p>
                <p className="font-display text-lg font-bold text-slate-900">
                  {money(c.annualSpend)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Saved</p>
                <p className="font-display text-lg font-bold text-emerald-600">
                  {money(c.savings)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <Badge color={STATUS_COLOR[c.status]}>{STATUS_LABEL[c.status]}</Badge>
              </div>
              <div>
                <p className="text-xs text-slate-400">Customer since</p>
                <p className="text-sm font-medium text-slate-700">
                  {shortDate(c.createdAt)}
                </p>
              </div>
            </div>
          </Card>

          {/* onboarding on behalf */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Onboarding
              </h2>
              <span className="text-sm font-semibold text-slate-500">{pct}% complete</span>
            </div>
            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
            <p className="mb-3 text-xs text-slate-400">
              Tick these off as you complete setup on the customer&apos;s behalf.
            </p>
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
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                      <p className="truncate text-xs text-slate-400">
                        {p.title} · {p.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* rail */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Account</h2>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Account manager
            </label>
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

            <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">
              Status
            </label>
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

            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Building className="h-4 w-4 text-brand-dark" /> View as user
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Drop into {c.name}&apos;s workspace to set things up or troubleshoot as
                the customer sees it.
              </p>
              <Button size="sm" className="mt-2 w-full" onClick={viewAsUser}>
                Open their workspace
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Activity</h2>
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
    </div>
  );
}
