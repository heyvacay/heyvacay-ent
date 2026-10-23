/**
 * Sales CRM domain model (prototype).
 *
 * This is the data the internal Sales console runs on — companies in the
 * pipeline, who owns them, onboarding progress, contacts and activity. Today
 * it's seeded and lives in the browser (crmStore); it moves to the real
 * ent.sales.nova backend with the same shapes when that service is stood up.
 */

export type AccountStatus = 'lead' | 'onboarding' | 'active' | 'churned';

export const STATUS_LABEL: Record<AccountStatus, string> = {
  lead: 'Lead',
  onboarding: 'Onboarding',
  active: 'Active',
  churned: 'Churned',
};

export const STATUS_ORDER: AccountStatus[] = ['lead', 'onboarding', 'active', 'churned'];

/** The sales reps a company can be assigned to. The signed-in rep is ME. */
export const REPS = ['Danil B.', 'Priya N.', 'Marcus L.'];
export const ME = 'Danil B.';

export interface Contact {
  name: string;
  title: string;
  email: string;
}

export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
}

export const ONBOARDING_TEMPLATE: Omit<OnboardingStep, 'done'>[] = [
  { key: 'kickoff', label: 'Kickoff call' },
  { key: 'policy', label: 'Travel policy set' },
  { key: 'integrations', label: 'Accounting + HR connected' },
  { key: 'invite', label: 'Team invited' },
  { key: 'first_booking', label: 'First booking made' },
];

export interface ActivityEntry {
  date: string;
  text: string;
}

export interface SalesCompany {
  id: string;
  name: string;
  domain: string;
  status: AccountStatus;
  employees: number;
  hq: string;
  /** Account manager (a rep name) or undefined = unassigned. */
  accountManager?: string;
  /** Estimated annual travel spend under management. */
  annualSpend: number;
  /** Annualized savings delivered so far (active accounts). */
  savings: number;
  createdAt: string;
  onboarding: OnboardingStep[];
  contacts: Contact[];
  activity: ActivityEntry[];
}

function steps(done: string[]): OnboardingStep[] {
  return ONBOARDING_TEMPLATE.map((s) => ({ ...s, done: done.includes(s.key) }));
}

export const SEED_COMPANIES: SalesCompany[] = [
  {
    id: 'co_northwind',
    name: 'Northwind Robotics',
    domain: 'northwind.co',
    status: 'active',
    employees: 180,
    hq: 'San Francisco, USA',
    accountManager: 'Danil B.',
    annualSpend: 1_200_000,
    savings: 184_000,
    createdAt: '2026-06-12',
    onboarding: steps(['kickoff', 'policy', 'integrations', 'invite', 'first_booking']),
    contacts: [
      { name: 'Dana Okoro', title: 'VP Finance', email: 'dana@northwind.co' },
      { name: 'Sam Lee', title: 'Office Manager', email: 'sam@northwind.co' },
    ],
    activity: [
      { date: '2026-10-18', text: 'QBR scheduled for November' },
      { date: '2026-09-30', text: 'Crossed $150k in annualized savings' },
    ],
  },
  {
    id: 'co_lumen',
    name: 'Lumen Health',
    domain: 'lumenhealth.com',
    status: 'onboarding',
    employees: 90,
    hq: 'Austin, USA',
    accountManager: 'Danil B.',
    annualSpend: 540_000,
    savings: 0,
    createdAt: '2026-10-02',
    onboarding: steps(['kickoff', 'policy']),
    contacts: [
      { name: 'Priti Shah', title: 'Head of People', email: 'priti@lumenhealth.com' },
    ],
    activity: [
      { date: '2026-10-19', text: 'Travel policy drafted — awaiting sign-off' },
      { date: '2026-10-02', text: 'Kickoff call completed' },
    ],
  },
  {
    id: 'co_vela',
    name: 'Vela Logistics',
    domain: 'vela.io',
    status: 'lead',
    employees: 320,
    hq: 'Chicago, USA',
    accountManager: undefined,
    annualSpend: 2_100_000,
    savings: 0,
    createdAt: '2026-10-15',
    onboarding: steps([]),
    contacts: [
      { name: 'Marco Diaz', title: 'CFO', email: 'marco@vela.io' },
    ],
    activity: [{ date: '2026-10-15', text: 'Inbound demo request' }],
  },
  {
    id: 'co_brightside',
    name: 'Brightside Media',
    domain: 'brightside.tv',
    status: 'active',
    employees: 60,
    hq: 'New York, USA',
    accountManager: 'Priya N.',
    annualSpend: 410_000,
    savings: 57_000,
    createdAt: '2026-05-20',
    onboarding: steps(['kickoff', 'policy', 'integrations', 'invite', 'first_booking']),
    contacts: [{ name: 'Alex Kim', title: 'COO', email: 'alex@brightside.tv' }],
    activity: [{ date: '2026-10-10', text: 'Expanded to international travel' }],
  },
  {
    id: 'co_quanta',
    name: 'Quanta Labs',
    domain: 'quanta.ai',
    status: 'onboarding',
    employees: 45,
    hq: 'Boston, USA',
    accountManager: 'Marcus L.',
    annualSpend: 300_000,
    savings: 0,
    createdAt: '2026-10-08',
    onboarding: steps(['kickoff']),
    contacts: [{ name: 'Lena Park', title: 'Ops Lead', email: 'lena@quanta.ai' }],
    activity: [{ date: '2026-10-08', text: 'Signed order form' }],
  },
  {
    id: 'co_harbor',
    name: 'Harbor Foods',
    domain: 'harborfoods.com',
    status: 'lead',
    employees: 500,
    hq: 'Seattle, USA',
    accountManager: undefined,
    annualSpend: 3_400_000,
    savings: 0,
    createdAt: '2026-10-20',
    onboarding: steps([]),
    contacts: [{ name: 'Rob Vance', title: 'VP Ops', email: 'rob@harborfoods.com' }],
    activity: [{ date: '2026-10-20', text: 'Referred by Northwind' }],
  },
];

export function onboardingPct(c: SalesCompany): number {
  if (!c.onboarding.length) return 0;
  return Math.round(
    (c.onboarding.filter((s) => s.done).length / c.onboarding.length) * 100
  );
}
