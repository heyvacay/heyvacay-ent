import { money, num } from '@/lib/format';
import {
  NOVA_COMPANIES,
  NOVA_OPS,
  NOVA_MONTHS,
  NOVA_GMV_SERIES,
  NOVA_COMMISSION_SERIES,
  totals,
  type NovaCompany,
  type NovaOpsItem,
} from '@/lib/nova';

const BRAND = '#23e3ef';

function compact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function Card({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`rounded-2xl border border-line bg-surface/60 p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-extrabold tracking-tight ${
          accent ? 'text-brand' : 'text-white'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-muted">{sub}</p>
    </Card>
  );
}

function Bars({ series }: { series: number[] }) {
  const max = Math.max(1, ...series);
  return (
    <div className="flex h-44 gap-3">
      {series.map((v, i) => (
        <div
          key={i}
          className="flex h-full flex-1 flex-col items-center gap-2"
          title={`${NOVA_MONTHS[i]}: ${compact(v)}`}
        >
          <span className="text-xs font-semibold text-mist">{compact(v)}</span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height: `${Math.max(2, (v / max) * 100)}%`,
                backgroundColor: BRAND,
              }}
            />
          </div>
          <span className="text-xs text-muted">{NOVA_MONTHS[i]}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS: Record<NovaCompany['status'], string> = {
  active: 'bg-emerald-400/15 text-emerald-300',
  trial: 'bg-brand/15 text-brand',
  onboarding: 'bg-sky-400/15 text-sky-300',
  paused: 'bg-slate-400/15 text-slate-300',
};
const HEALTH: Record<NovaCompany['health'], string> = {
  healthy: 'bg-emerald-400/15 text-emerald-300',
  watch: 'bg-amber-400/15 text-amber-300',
  risk: 'bg-red-400/15 text-red-300',
};
const SEV: Record<NovaOpsItem['severity'], string> = {
  risk: 'bg-red-400/15 text-red-300',
  watch: 'bg-amber-400/15 text-amber-300',
  info: 'bg-sky-400/15 text-sky-300',
};

export default function NovaPage() {
  const companies = [...NOVA_COMPANIES].sort((a, b) => b.gmv - a.gmv);

  return (
    <div className="space-y-8">
      <section id="overview">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          Portfolio overview
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every enterprise customer, platform revenue, and what needs attention.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="Companies" value={num(totals.companies)} sub="On the platform" />
          <Kpi
            label="Active travelers"
            value={num(totals.travelers)}
            sub="Across all tenants"
          />
          <Kpi label="Platform GMV" value={compact(totals.gmv)} sub="This month" />
          <Kpi
            accent
            label="Commission revenue"
            value={compact(totals.commission)}
            sub="HeyVacay, this month"
          />
          <Kpi
            label="Savings delivered"
            value={compact(totals.savings)}
            sub="To customers, this month"
          />
        </div>
      </section>

      <section id="revenue" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">
              Platform GMV
            </h2>
            <span className="text-sm text-muted">last 6 months</span>
          </div>
          <p className="mb-5 text-sm text-muted">
            Total travel booked through HeyVacay across all customers.
          </p>
          <Bars series={NOVA_GMV_SERIES} />
        </Card>
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">
              Commission revenue
            </h2>
            <span className="text-sm text-muted">last 6 months</span>
          </div>
          <p className="mb-5 text-sm text-muted">
            HeyVacay&apos;s cut from suppliers — companies never pay.
          </p>
          <Bars series={NOVA_COMMISSION_SERIES} />
        </Card>
      </section>

      <section id="companies">
        <Card className="!p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
            <h2 className="font-display text-lg font-bold text-white">
              Companies
            </h2>
            <span className="text-sm text-muted">{companies.length} tenants</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-semibold sm:px-6">Company</th>
                  <th className="px-5 py-3 font-semibold">Travelers</th>
                  <th className="px-5 py-3 font-semibold">GMV / mo</th>
                  <th className="px-5 py-3 font-semibold">Commission</th>
                  <th className="px-5 py-3 font-semibold">CSM</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Health</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 sm:px-6">
                      <p className="font-medium text-white">{c.name}</p>
                      <p className="text-xs text-muted">{c.industry}</p>
                    </td>
                    <td className="px-5 py-3 text-mist">{num(c.employees)}</td>
                    <td className="px-5 py-3 text-mist">{money(c.gmv)}</td>
                    <td className="px-5 py-3 font-medium text-brand">
                      {money(c.commission)}
                    </td>
                    <td className="px-5 py-3 text-muted">{c.csm}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS[c.status]}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${HEALTH[c.health]}`}
                      >
                        {c.health}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section id="support">
        <Card>
          <h2 className="font-display text-lg font-bold text-white">Ops queue</h2>
          <p className="mt-1 text-sm text-muted">
            What customer success and support should act on next.
          </p>
          <div className="mt-4 space-y-2.5">
            {NOVA_OPS.map((o) => (
              <div
                key={o.id}
                className="flex items-start gap-3 rounded-xl border border-line bg-navy/40 p-3.5"
              >
                <span
                  className={`mt-0.5 inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${SEV[o.severity]}`}
                >
                  {o.severity}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{o.company}</p>
                  <p className="text-sm text-muted">{o.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
