'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { Button, Card, Input, PageHeader, Select, cn } from '@/components/app/ui';
import { Plane, Receipt, Shield, Check, Calendar, Users } from '@/components/icons';
import type {
  BookingApprovalMode,
  FlightCabinTier,
  GuestBookingMode,
  Policy,
  PolicyAction,
} from '@/lib/types';

const APPROVAL_MODES: { value: BookingApprovalMode; label: string; desc: string }[] = [
  {
    value: 'open',
    label: 'Book freely — no approval',
    desc: 'Employees book on their own. Your travel policy above still flags anything out of policy.',
  },
  {
    value: 'pre_approval',
    label: 'Require approval before booking',
    desc: 'Every trip is sent to a manager and only confirmed once they approve it.',
  },
  {
    value: 'event_required',
    label: 'Only against an approved event',
    desc: 'Employees can only book travel tied to a manager-approved event.',
  },
];

const GUEST_MODES: { value: GuestBookingMode; label: string; desc: string }[] = [
  {
    value: 'allowed',
    label: 'Allow — book directly',
    desc: 'Anyone can book under a custom name without extra sign-off (default).',
  },
  {
    value: 'approval',
    label: 'Require approval',
    desc: 'A booking under a custom name is sent to a manager before it’s confirmed.',
  },
];

const CABINS = ['Economy', 'Premium economy', 'Business', 'First'];
const ACTIONS: { value: PolicyAction; label: string }[] = [
  { value: 'allow', label: 'Allow' },
  { value: 'warn', label: 'Warn traveler' },
  { value: 'approve', label: 'Needs approval' },
  { value: 'block', label: 'Block booking' },
];

function cabinRank(cabin: string): number {
  const c = cabin.toLowerCase();
  if (c.includes('first')) return 3;
  if (c.includes('business')) return 2;
  if (c.includes('premium')) return 1;
  return 0;
}

/* ---------------- small controls ---------------- */

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        on ? 'bg-brand' : 'bg-slate-200'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          on ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

function ActionSelect({
  value,
  onChange,
}: {
  value: PolicyAction;
  onChange: (a: PolicyAction) => void;
}) {
  return (
    <span className="inline-block w-44 align-middle">
      <Select value={value} onChange={(e) => onChange(e.target.value as PolicyAction)}>
        {ACTIONS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </Select>
    </span>
  );
}

function NumInput({
  value,
  onChange,
  width = 'w-20',
  suffix,
  prefix,
}: {
  value: number;
  onChange: (n: number) => void;
  width?: string;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {prefix && <span className="text-slate-500">{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          width,
          'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-semibold text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25'
        )}
      />
      {suffix && <span className="text-slate-500">{suffix}</span>}
    </span>
  );
}

/** A rule row: plain-English sentence on the left, action + toggle on the right. */
function Rule({
  enabled,
  onToggle,
  children,
  action,
  onAction,
}: {
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: PolicyAction;
  onAction?: (a: PolicyAction) => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between',
        !enabled && 'opacity-60'
      )}
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm text-slate-700">
        {children}
      </div>
      <div className="flex items-center gap-3">
        {action && onAction && <ActionSelect value={action} onChange={onAction} />}
        <Toggle on={enabled} onClick={onToggle} />
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-dark">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-400">{sub}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

/* ---------------- flight preview ---------------- */

const SAMPLE_FLIGHTS = [
  { route: 'SFO → LAX', hours: 1.5 },
  { route: 'SFO → ORD', hours: 4.2 },
  { route: 'JFK → LHR', hours: 7 },
  { route: 'SFO → LHR', hours: 10.5 },
  { route: 'JFK → NRT', hours: 14 },
];

function allowedCabin(tiers: FlightCabinTier[], hours: number): string {
  const sorted = [...tiers].sort(
    (a, b) => (a.upToHours ?? Infinity) - (b.upToHours ?? Infinity)
  );
  const tier =
    sorted.find((t) => t.upToHours == null || hours <= t.upToHours) ??
    sorted[sorted.length - 1];
  return tier?.cabin ?? 'Economy';
}

function FlightPreview({ tiers }: { tiers: FlightCabinTier[] }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Preview — what each flight length allows
      </p>
      <div className="space-y-1.5">
        {SAMPLE_FLIGHTS.map((f) => (
          <div
            key={f.route}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-slate-600">
              {f.route}{' '}
              <span className="text-slate-400">· {f.hours}h</span>
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-brand-dark">
              <Check className="h-3.5 w-3.5" /> up to {allowedCabin(tiers, f.hours)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function PoliciesPage() {
  const {
    state,
    isSuperAdmin,
    fullAccess,
    accessControl,
    setAccessControl,
    changePolicy,
    resolvePolicyChange,
    guestBookingMode,
    setGuestBookingMode,
  } = useStore();
  const byType = (t: Policy['type']) => state.policies.find((p) => p.type === t);
  const companyMode = state.company.approvalMode ?? 'open';

  // Policy edits route through the approval loop: super admins apply directly,
  // team admins file a request a super admin approves. These wrappers keep the
  // UI unchanged while enforcing that.
  const [requestedNote, setRequestedNote] = useState<string | null>(null);
  const run = (result: 'applied' | 'requested', summary: string) => {
    if (result === 'requested') {
      setRequestedNote(summary);
      window.clearTimeout((run as unknown as { t?: number }).t);
      (run as unknown as { t?: number }).t = window.setTimeout(() => setRequestedNote(null), 6000);
    }
  };
  const pName = (id: string) => state.policies.find((p) => p.id === id)?.name ?? 'policy';
  const togglePolicy = (id: string) => {
    const on = state.policies.find((p) => p.id === id)?.enabled;
    run(changePolicy({ kind: 'toggle', id }, `${on ? 'Disable' : 'Enable'} “${pName(id)}”`), `“${pName(id)}”`);
  };
  const updatePolicy = (id: string, patch: Partial<Omit<Policy, 'id'>>) =>
    run(changePolicy({ kind: 'update', id, patch }, `Update “${pName(id)}”`), `“${pName(id)}”`);
  const addPolicy = (p: Omit<Policy, 'id'>) =>
    run(changePolicy({ kind: 'add', policy: p }, `Add policy “${p.name}”`), `“${p.name}”`);
  const removePolicy = (id: string) =>
    run(changePolicy({ kind: 'remove', id }, `Remove “${pName(id)}”`), `“${pName(id)}”`);
  const setCompanyApprovalMode = (mode: BookingApprovalMode) =>
    run(changePolicy({ kind: 'companyMode', mode }, `Company approval mode → ${mode}`), 'company approval mode');
  const setUserApprovalMode = (userId: string, mode: BookingApprovalMode | 'default') => {
    const n = state.users.find((u) => u.id === userId)?.name ?? 'employee';
    run(changePolicy({ kind: 'userMode', userId, mode }, `${n} approval → ${mode}`), `${n}’s approval`);
  };
  const setDepartmentApprovalMode = (dept: string, mode: BookingApprovalMode | 'default') =>
    run(changePolicy({ kind: 'deptMode', dept, mode }, `${dept} dept approval → ${mode}`), `${dept} approval`);

  const pendingPolicyReqs = (state.policyChangeRequests ?? []).filter((r) => r.status === 'pending');

  // Smart overrides: searchable employee list (scales to thousands) + the
  // distinct departments for department-level overrides.
  const [empQuery, setEmpQuery] = useState('');
  const activeUsers = useMemo(
    () => state.users.filter((u) => u.status === 'active'),
    [state.users]
  );
  const departments = useMemo(
    () => Array.from(new Set(activeUsers.map((u) => u.department).filter(Boolean))).sort(),
    [activeUsers]
  );
  const deptModes = state.departmentApprovalModes ?? {};
  const eq = empQuery.trim().toLowerCase();
  // Show matches when searching; otherwise only people who already have an
  // override set (so the list stays short at 1,000 employees).
  const shownUsers = useMemo(() => {
    if (eq)
      return activeUsers
        .filter((u) =>
          [u.name, u.title, u.department, u.email].some((f) => f?.toLowerCase().includes(eq))
        )
        .slice(0, 25);
    return activeUsers.filter((u) => u.approvalMode && u.approvalMode !== 'default');
  }, [activeUsers, eq]);

  // Multiple nightly-rate rules (e.g. >$400 approve, >$1000 block, per city).
  const nightlyRules = state.policies.filter((p) => p.type === 'max_nightly');
  const star = byType('max_hotel_star');
  const flight = byType('flight_cabin_by_duration');
  const advance = byType('advance_days');

  const addNightlyRule = () =>
    addPolicy({
      name: 'Nightly rate cap',
      type: 'max_nightly',
      value: 500,
      action: 'approve',
      enabled: true,
    });

  const setTiers = (tiers: FlightCabinTier[]) =>
    flight && updatePolicy(flight.id, { tiers });

  const tiers = flight?.tiers ?? [];
  const numericTiers = tiers.filter((t) => t.upToHours != null);
  const openTier = tiers.find((t) => t.upToHours == null);

  const addTier = () => {
    const last = numericTiers[numericTiers.length - 1]?.upToHours ?? 2;
    const next: FlightCabinTier = { upToHours: Number(last) + 4, cabin: 'Economy' };
    setTiers([...numericTiers, next, openTier ?? { upToHours: null, cabin: 'Business' }]);
  };
  const updateTier = (i: number, patch: Partial<FlightCabinTier>) => {
    const copy = numericTiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    setTiers([...copy, openTier ?? { upToHours: null, cabin: 'Business' }]);
  };
  const removeTier = (i: number) => {
    const copy = numericTiers.filter((_, idx) => idx !== i);
    setTiers([...copy, openTier ?? { upToHours: null, cabin: 'Business' }]);
  };

  return (
    <div>
      <PageHeader
        title="Travel policy"
        subtitle="Plain-English rules that run the moment someone books — edit any number right in the sentence."
      />

      {!isSuperAdmin && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span>
            As a team admin, your policy changes are sent to a super admin for approval before they
            take effect.
          </span>
        </div>
      )}
      {requestedNote && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 p-3 text-sm font-medium text-brand-dark">
          <Check className="h-4 w-4" /> Change to {requestedNote} sent for approval.
        </div>
      )}

      {/* Access & visibility — who can see ALL company data */}
      <Card className="mb-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Access &amp; visibility</h2>
        <p className="mt-1 text-sm text-slate-500">
          Everyone sees their own trips, and team managers see their team. Pick which{' '}
          <span className="font-medium">roles</span> and <span className="font-medium">departments</span>{' '}
          can see <span className="font-medium">all</span> company data — every team&apos;s trips,
          expenses, budgets and policies. The account owner always can.
        </p>
        {!fullAccess && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Only the owner or someone with full data access can change these settings.
          </p>
        )}
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Roles</p>
            <div className="space-y-1.5">
              {(['admin', 'booker', 'employee'] as const).map((r) => {
                const on = accessControl.fullAccessRoles.includes(r);
                return (
                  <label
                    key={r}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm capitalize',
                      on ? 'border-brand bg-brand/5 text-slate-900' : 'border-slate-200 text-slate-600',
                      !fullAccess && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!fullAccess}
                      onChange={() =>
                        setAccessControl({
                          fullAccessRoles: on
                            ? accessControl.fullAccessRoles.filter((x) => x !== r)
                            : [...accessControl.fullAccessRoles, r],
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    {r === 'admin' ? 'Admins' : r === 'booker' ? 'Bookers' : 'Employees'}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Departments
            </p>
            <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
              {departments.map((d) => {
                const on = accessControl.fullAccessDepartments.includes(d);
                return (
                  <label
                    key={d}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm',
                      on ? 'border-brand bg-brand/5 text-slate-900' : 'border-slate-200 text-slate-600',
                      !fullAccess && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!fullAccess}
                      onChange={() =>
                        setAccessControl({
                          fullAccessDepartments: on
                            ? accessControl.fullAccessDepartments.filter((x) => x !== d)
                            : [...accessControl.fullAccessDepartments, d],
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    {d}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Need one specific person to see everything? Give them full access on their profile in{' '}
          <span className="font-medium">People</span>.
        </p>
      </Card>

      {/* Super-admin: pending policy-change approvals */}
      {isSuperAdmin && pendingPolicyReqs.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900">
            Policy changes awaiting your approval
          </h2>
          <p className="mb-3 text-xs text-slate-500">Requested by team admins.</p>
          <div className="space-y-2">
            {pendingPolicyReqs.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{r.summary}</p>
                  <p className="text-xs text-slate-400">Requested by {r.byName}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => resolvePolicyChange(r.id, true)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolvePolicyChange(r.id, false)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {/* Approval workflow */}
        <SectionCard
          icon={<Users className="h-5 w-5" />}
          title="Booking approval"
          sub="Decide how much sign-off a trip needs before it's booked. Set a company default, then override it for any individual."
        >
          <div className="space-y-2">
            {APPROVAL_MODES.map((m) => (
              <label
                key={m.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                  companyMode === m.value
                    ? 'border-brand bg-brand/5'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <input
                  type="radio"
                  name="company-approval-mode"
                  checked={companyMode === m.value}
                  onChange={() => setCompanyApprovalMode(m.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand focus:ring-brand"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{m.label}</span>
                  <span className="block text-xs text-slate-400">{m.desc}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Per-department override */}
          <div className="mt-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Per-department override
              </p>
              <p className="text-xs text-slate-400">Applies to everyone in the department</p>
            </div>
            <div className="divide-y divide-slate-100">
              {departments.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-400">No departments yet.</p>
              )}
              {departments.map((dept) => {
                const count = activeUsers.filter((u) => u.department === dept).length;
                return (
                  <div key={dept} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{dept}</p>
                      <p className="text-xs text-slate-400">
                        {count} {count === 1 ? 'person' : 'people'}
                      </p>
                    </div>
                    <span className="inline-block w-56 shrink-0">
                      <Select
                        value={deptModes[dept] ?? 'default'}
                        onChange={(e) =>
                          setDepartmentApprovalMode(
                            dept,
                            e.target.value as BookingApprovalMode | 'default'
                          )
                        }
                      >
                        <option value="default">Company default</option>
                        {APPROVAL_MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-employee override (searchable) */}
          <div className="mt-4 rounded-xl border border-slate-200">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Per-employee override
              </p>
              <div className="w-full sm:w-64">
                <Input
                  value={empQuery}
                  onChange={(e) => setEmpQuery(e.target.value)}
                  placeholder="Search name, title, dept, email…"
                />
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {shownUsers.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-400">
                  {eq
                    ? 'No employees match your search.'
                    : 'No per-employee overrides set. Search above to add one — everyone else follows their department or the company default.'}
                </p>
              )}
              {shownUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{u.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {u.title} · {u.department}
                    </p>
                  </div>
                  <span className="inline-block w-56 shrink-0">
                    <Select
                      value={u.approvalMode ?? 'default'}
                      onChange={(e) =>
                        setUserApprovalMode(
                          u.id,
                          e.target.value as BookingApprovalMode | 'default'
                        )
                      }
                    >
                      <option value="default">
                        {deptModes[u.department]
                          ? `Department default (${deptModes[u.department]})`
                          : 'Company default'}
                      </option>
                      {APPROVAL_MODES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </span>
                </div>
              ))}
            </div>
            {eq && shownUsers.length === 25 && (
              <p className="px-4 py-2 text-xs text-slate-400">
                Showing the first 25 matches — refine your search to narrow it down.
              </p>
            )}
          </div>
        </SectionCard>

        {/* Booking for a custom / guest name */}
        <SectionCard
          icon={<Users className="h-5 w-5" />}
          title="Booking for others (custom name)"
          sub="When someone books a trip under a custom name — a guest, candidate, or contractor who isn't in the system — decide whether they can do it themselves or if it needs a manager's sign-off."
        >
          <div className="space-y-2">
            {GUEST_MODES.map((m) => (
              <label
                key={m.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                  guestBookingMode === m.value
                    ? 'border-brand bg-brand/5'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <input
                  type="radio"
                  name="guest-booking-mode"
                  checked={guestBookingMode === m.value}
                  onChange={() => setGuestBookingMode(m.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand focus:ring-brand"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{m.label}</span>
                  <span className="block text-xs text-slate-400">{m.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Hotels */}
        <SectionCard
          icon={<Receipt className="h-5 w-5" />}
          title="Hotels"
          sub="Add as many nightly-rate rules as you need — e.g. over $400 needs approval, over $1,000 blocks. Scope any rule to a city."
        >
          {nightlyRules.map((nightly) => (
            <Rule
              key={nightly.id}
              enabled={nightly.enabled}
              onToggle={() => togglePolicy(nightly.id)}
              action={nightly.action}
              onAction={(a) => updatePolicy(nightly.id, { action: a })}
            >
              <span>Hotel rooms over</span>
              <NumInput
                prefix="$"
                value={Number(nightly.value)}
                onChange={(n) => updatePolicy(nightly.id, { value: n })}
              />
              <span>per night</span>
              <span className="text-slate-400">in</span>
              <input
                value={nightly.city ?? ''}
                onChange={(e) => updatePolicy(nightly.id, { city: e.target.value || undefined })}
                placeholder="any city"
                className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
              <button
                onClick={() => removePolicy(nightly.id)}
                className="ml-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                Remove
              </button>
            </Rule>
          ))}
          <Button variant="ghost" size="sm" onClick={addNightlyRule}>
            + Add nightly-rate rule
          </Button>
          {star && (
            <Rule
              enabled={star.enabled}
              onToggle={() => togglePolicy(star.id)}
              action={star.action}
              onAction={(a) => updatePolicy(star.id, { action: a })}
            >
              <span>Hotels above</span>
              <span className="inline-block w-20 align-middle">
                <Select
                  value={String(star.value)}
                  onChange={(e) => updatePolicy(star.id, { value: Number(e.target.value) })}
                >
                  {[3, 4, 5].map((s) => (
                    <option key={s} value={s}>
                      {s}★
                    </option>
                  ))}
                </Select>
              </span>
              <span>stars</span>
            </Rule>
          )}
        </SectionCard>

        {/* Flights */}
        <SectionCard
          icon={<Plane className="h-5 w-5" />}
          title="Flights"
          sub="Allow a higher cabin as flights get longer — set a tier per flight length."
        >
          {flight && (
            <div
              className={cn(
                'rounded-xl border border-slate-200 p-4',
                !flight.enabled && 'opacity-60'
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  Cabin by flight length
                </p>
                <div className="flex items-center gap-3">
                  <ActionSelect
                    value={flight.action}
                    onChange={(a) => updatePolicy(flight.id, { action: a })}
                  />
                  <Toggle
                    on={flight.enabled}
                    onClick={() => togglePolicy(flight.id)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {numericTiers.map((t, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-1.5 text-sm text-slate-700"
                  >
                    <span>Flights up to</span>
                    <NumInput
                      value={Number(t.upToHours)}
                      onChange={(n) => updateTier(i, { upToHours: n })}
                      width="w-16"
                      suffix="h"
                    />
                    <span>→</span>
                    <span className="inline-block w-52 align-middle">
                      <Select
                        value={t.cabin}
                        onChange={(e) => updateTier(i, { cabin: e.target.value })}
                      >
                        {CABINS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </span>
                    <button
                      onClick={() => removeTier(i)}
                      className="ml-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {openTier && (
                  <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-700">
                    <span>Flights longer than that</span>
                    <span>→</span>
                    <span className="inline-block w-52 align-middle">
                      <Select
                        value={openTier.cabin}
                        onChange={(e) =>
                          setTiers([
                            ...numericTiers,
                            { upToHours: null, cabin: e.target.value },
                          ])
                        }
                      >
                        {CABINS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </span>
                  </div>
                )}
              </div>

              <Button variant="ghost" size="sm" className="mt-2" onClick={addTier}>
                + Add tier
              </Button>

              <div className="mt-4">
                <FlightPreview tiers={tiers} />
              </div>
            </div>
          )}
        </SectionCard>

        {/* Advance booking */}
        <SectionCard
          icon={<Calendar className="h-5 w-5" />}
          title="Advance booking"
          sub="Encourage booking early for better fares."
        >
          {advance && (
            <Rule
              enabled={advance.enabled}
              onToggle={() => togglePolicy(advance.id)}
              action={advance.action}
              onAction={(a) => updatePolicy(advance.id, { action: a })}
            >
              <span>Trips booked fewer than</span>
              <NumInput
                value={Number(advance.value)}
                onChange={(n) => updatePolicy(advance.id, { value: n })}
                width="w-16"
              />
              <span>days ahead</span>
            </Rule>
          )}
        </SectionCard>

        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5" /> Changes apply instantly. &quot;Needs
          approval&quot; routes a booking to an admin; &quot;Block&quot; stops it
          outright.
        </p>
      </div>
    </div>
  );
}
