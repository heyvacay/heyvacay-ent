/**
 * Sales CRM domain model (Nova).
 *
 * This is the data the internal Sales console runs on — companies in the
 * pipeline, the deals and contracts attached to them, the rep's tasks, and
 * the activity trail. Today it's seeded and lives in the browser (crmStore);
 * it moves to the real ent.sales.nova backend with the same shapes when that
 * service is stood up.
 */

export type AccountStatus = 'lead' | 'onboarding' | 'active' | 'churned';

export const STATUS_LABEL: Record<AccountStatus, string> = {
  lead: 'Lead',
  onboarding: 'Onboarding',
  active: 'Active',
  churned: 'Churned',
};

export const STATUS_ORDER: AccountStatus[] = ['lead', 'onboarding', 'active', 'churned'];

export const STATUS_COLOR: Record<AccountStatus, 'slate' | 'amber' | 'green' | 'red'> = {
  lead: 'slate',
  onboarding: 'amber',
  active: 'green',
  churned: 'red',
};

/** The sales reps a company can be assigned to. The signed-in rep is ME. */
export const REPS = ['Danil B.', 'Priya N.', 'Marcus L.'];
export const ME = 'Danil B.';

/** Each rep carries an annual new-business quota (ACV). Drives attainment. */
export const QUOTA: Record<string, number> = {
  'Danil B.': 1_500_000,
  'Priya N.': 1_200_000,
  'Marcus L.': 900_000,
};

export type RepRole = 'Admin' | 'Account Executive' | 'SDR';

export interface Rep {
  name: string;
  role: RepRole;
  quota: number;
  /** email, for invites — optional in the prototype. */
  email?: string;
}

/** Seed sales team. Danil is the admin and can manage the others. */
export const SEED_REPS: Rep[] = [
  { name: 'Danil B.', role: 'Admin', quota: QUOTA['Danil B.'], email: 'danilb@heyvacay.co' },
  { name: 'Priya N.', role: 'Account Executive', quota: QUOTA['Priya N.'], email: 'priya@heyvacay.co' },
  { name: 'Marcus L.', role: 'Account Executive', quota: QUOTA['Marcus L.'], email: 'marcus@heyvacay.co' },
];

export const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Logistics',
  'Media',
  'Finance',
  'Manufacturing',
  'Retail',
  'Professional Services',
] as const;

export type Tier = 'Enterprise' | 'Mid-Market' | 'SMB';
export const TIERS: Tier[] = ['Enterprise', 'Mid-Market', 'SMB'];

export interface Contact {
  name: string;
  title: string;
  email: string;
  phone?: string;
  /** Marks the economic buyer / primary decision maker. */
  champion?: boolean;
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

export interface Note {
  id: string;
  text: string;
  author: string;
  date: string;
}

/* ---------------- deals ---------------- */

export type DealStage =
  | 'qualify'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export const DEAL_STAGES: DealStage[] = [
  'qualify',
  'proposal',
  'negotiation',
  'won',
  'lost',
];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  qualify: 'Qualify',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Closed won',
  lost: 'Closed lost',
};

/** Default close probability per stage (weights the forecast). */
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  qualify: 20,
  proposal: 45,
  negotiation: 70,
  won: 100,
  lost: 0,
};

export interface Deal {
  id: string;
  companyId: string;
  name: string;
  stage: DealStage;
  /** Annual contract value. */
  value: number;
  probability: number;
  closeDate: string;
  owner: string;
  createdAt: string;
}

export const isOpen = (d: Deal) => d.stage !== 'won' && d.stage !== 'lost';

/* ---------------- tasks ---------------- */

export type TaskType = 'call' | 'email' | 'meeting' | 'todo';

export const TASK_LABEL: Record<TaskType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  todo: 'To-do',
};

export interface CrmTask {
  id: string;
  companyId: string;
  title: string;
  type: TaskType;
  due: string;
  done: boolean;
  owner: string;
  createdAt: string;
}

/* ---------------- contracts ---------------- */

export type ContractType = 'msa' | 'order' | 'pilot' | 'renewal' | 'amendment';
export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  msa: 'Master Services Agreement',
  order: 'Order Form',
  pilot: 'Pilot Agreement',
  renewal: 'Renewal',
  amendment: 'Amendment',
};

export type PricingModel = 'commission' | 'platform' | 'hybrid';
export const PRICING_LABEL: Record<PricingModel, string> = {
  commission: 'Commission-only (free to customer)',
  platform: 'Platform fee',
  hybrid: 'Hybrid (reduced commission + fee)',
};

export type ContractStatus = 'draft' | 'sent' | 'signed';
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Draft',
  sent: 'Sent for signature',
  signed: 'Signed',
};
export const CONTRACT_STATUS_COLOR: Record<ContractStatus, 'slate' | 'amber' | 'green'> = {
  draft: 'slate',
  sent: 'amber',
  signed: 'green',
};

/** The answers captured by the contract wizard — everything the doc needs. */
export interface ContractTerms {
  type: ContractType;
  pricingModel: PricingModel;
  commissionPct: number;
  platformFee: number; // annual, 0 when not applicable
  discountPct: number;
  termMonths: number;
  startDate: string;
  paymentTerms: string; // e.g. "Net 30"
  minimumSpend: number; // annual committed spend, 0 = none
  supportTier: string; // Standard | Priority | Dedicated
  autoRenew: boolean;
  governingLaw: string;
  signerName: string;
  signerTitle: string;
}

export interface Signature {
  name: string;
  date: string;
}

export interface Contract {
  id: string;
  companyId: string;
  title: string;
  status: ContractStatus;
  terms: ContractTerms;
  value: number; // ACV this contract represents
  createdAt: string;
  createdBy: string;
  /** E-signatures captured via the shareable sign link. */
  signatures?: {
    heyvacay?: Signature;
    customer?: Signature;
  };
}

/* ---------------- company ---------------- */

/**
 * Commission configuration — how much HeyVacay earns on a booking. Mirrors the
 * Nova admin commission panel exactly: a rate per hotel star tier (the
 * fallback) plus region and hotel overrides. Precedence: hotel beats region,
 * region beats the star-based rate. Every change is logged to history.
 */
export type CommissionScope = 'star' | 'region' | 'hotel';

export interface CommissionRule {
  starRating: number; // 0–5 (0 = unrated/unknown)
  commissionPercent: number;
}

export interface CommissionOverride {
  id: string;
  scope: 'hotel' | 'region';
  hotelHid?: number | null;
  regionId?: number | null;
  targetLabel: string;
  commissionPercent: number;
  lastChangedBy: string | null;
  lastChangedAt: string | null;
}

export interface CommissionHistoryEntry {
  id: string;
  scope: CommissionScope;
  targetLabel: string;
  action: 'created' | 'updated' | 'removed';
  oldPercent: number | null;
  newPercent: number | null;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

export interface CommissionState {
  starRules: CommissionRule[];
  overrides: CommissionOverride[];
  history: CommissionHistoryEntry[];
}

export const DEFAULT_COMMISSION: CommissionState = {
  starRules: [
    { starRating: 0, commissionPercent: 8 },
    { starRating: 1, commissionPercent: 8 },
    { starRating: 2, commissionPercent: 9 },
    { starRating: 3, commissionPercent: 10 },
    { starRating: 4, commissionPercent: 12 },
    { starRating: 5, commissionPercent: 15 },
  ],
  overrides: [],
  history: [],
};

export interface SalesCompany {
  id: string;
  name: string;
  domain: string;
  website?: string;
  status: AccountStatus;
  industry: string;
  tier: Tier;
  employees: number;
  hq: string;
  /** Account manager (a rep name) or undefined = unassigned. */
  accountManager?: string;
  /** Estimated annual travel spend under management. */
  annualSpend: number;
  /** Annualized savings delivered so far (active accounts). */
  savings: number;
  /** 0–100 account-health score. */
  health: number;
  nextStep?: string;
  createdAt: string;
  onboarding: OnboardingStep[];
  contacts: Contact[];
  deals: Deal[];
  contracts: Contract[];
  tasks: CrmTask[];
  notes: Note[];
  activity: ActivityEntry[];
}

function steps(done: string[]): OnboardingStep[] {
  return ONBOARDING_TEMPLATE.map((s) => ({ ...s, done: done.includes(s.key) }));
}

/* ---------------- seed ---------------- */

export const SEED_COMPANIES: SalesCompany[] = [
  {
    id: 'co_northwind',
    name: 'Northwind Robotics',
    domain: 'northwind.co',
    website: 'https://northwind.co',
    status: 'active',
    industry: 'Technology',
    tier: 'Enterprise',
    employees: 180,
    hq: 'San Francisco, USA',
    accountManager: 'Danil B.',
    annualSpend: 1_200_000,
    savings: 184_000,
    health: 88,
    nextStep: 'QBR + international expansion upsell',
    createdAt: '2026-06-12',
    onboarding: steps(['kickoff', 'policy', 'integrations', 'invite', 'first_booking']),
    contacts: [
      { name: 'Dana Okoro', title: 'VP Finance', email: 'dana@northwind.co', phone: '+1 415 555 0192', champion: true },
      { name: 'Sam Lee', title: 'Office Manager', email: 'sam@northwind.co' },
    ],
    deals: [
      {
        id: 'd_nw_exp',
        companyId: 'co_northwind',
        name: 'International travel expansion',
        stage: 'negotiation',
        value: 380_000,
        probability: 70,
        closeDate: '2026-11-20',
        owner: 'Danil B.',
        createdAt: '2026-10-01',
      },
    ],
    contracts: [
      {
        id: 'ct_nw_msa',
        companyId: 'co_northwind',
        title: 'Master Services Agreement',
        status: 'signed',
        value: 1_200_000,
        createdAt: '2026-06-12',
        createdBy: 'Danil B.',
        terms: {
          type: 'msa',
          pricingModel: 'commission',
          commissionPct: 0,
          platformFee: 0,
          discountPct: 0,
          termMonths: 24,
          startDate: '2026-06-15',
          paymentTerms: 'Net 30',
          minimumSpend: 0,
          supportTier: 'Dedicated',
          autoRenew: true,
          governingLaw: 'State of Delaware, USA',
          signerName: 'Dana Okoro',
          signerTitle: 'VP Finance',
        },
      },
    ],
    tasks: [
      {
        id: 't_nw_1',
        companyId: 'co_northwind',
        title: 'Prep November QBR deck',
        type: 'todo',
        due: '2026-10-28',
        done: false,
        owner: 'Danil B.',
        createdAt: '2026-10-18',
      },
      {
        id: 't_nw_2',
        companyId: 'co_northwind',
        title: 'Call Dana re: EU rollout',
        type: 'call',
        due: '2026-10-25',
        done: false,
        owner: 'Danil B.',
        createdAt: '2026-10-20',
      },
    ],
    notes: [
      {
        id: 'n_nw_1',
        text: 'Dana is pushing for a dedicated CSM before expanding to EMEA. Strong champion.',
        author: 'Danil B.',
        date: '2026-10-18',
      },
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
    website: 'https://lumenhealth.com',
    status: 'onboarding',
    industry: 'Healthcare',
    tier: 'Mid-Market',
    employees: 90,
    hq: 'Austin, USA',
    accountManager: 'Danil B.',
    annualSpend: 540_000,
    savings: 0,
    health: 72,
    nextStep: 'Get travel policy signed off',
    createdAt: '2026-10-02',
    onboarding: steps(['kickoff', 'policy']),
    contacts: [
      { name: 'Priti Shah', title: 'Head of People', email: 'priti@lumenhealth.com', phone: '+1 512 555 0110', champion: true },
    ],
    deals: [
      {
        id: 'd_lum_land',
        companyId: 'co_lumen',
        name: 'Lumen Health — initial rollout',
        stage: 'won',
        value: 540_000,
        probability: 100,
        closeDate: '2026-10-02',
        owner: 'Danil B.',
        createdAt: '2026-09-10',
      },
    ],
    contracts: [
      {
        id: 'ct_lum_order',
        companyId: 'co_lumen',
        title: 'Order Form — 2026',
        status: 'signed',
        value: 540_000,
        createdAt: '2026-10-02',
        createdBy: 'Danil B.',
        terms: {
          type: 'order',
          pricingModel: 'commission',
          commissionPct: 0,
          platformFee: 0,
          discountPct: 0,
          termMonths: 12,
          startDate: '2026-10-05',
          paymentTerms: 'Net 30',
          minimumSpend: 0,
          supportTier: 'Priority',
          autoRenew: true,
          governingLaw: 'State of Texas, USA',
          signerName: 'Priti Shah',
          signerTitle: 'Head of People',
        },
      },
    ],
    tasks: [
      {
        id: 't_lum_1',
        companyId: 'co_lumen',
        title: 'Chase policy sign-off',
        type: 'email',
        due: '2026-10-24',
        done: false,
        owner: 'Danil B.',
        createdAt: '2026-10-19',
      },
    ],
    notes: [],
    activity: [
      { date: '2026-10-19', text: 'Travel policy drafted — awaiting sign-off' },
      { date: '2026-10-02', text: 'Kickoff call completed' },
    ],
  },
  {
    id: 'co_vela',
    name: 'Vela Logistics',
    domain: 'vela.io',
    website: 'https://vela.io',
    status: 'lead',
    industry: 'Logistics',
    tier: 'Enterprise',
    employees: 320,
    hq: 'Chicago, USA',
    accountManager: 'Danil B.',
    annualSpend: 2_100_000,
    savings: 0,
    health: 55,
    nextStep: 'Send proposal + ROI model',
    createdAt: '2026-10-15',
    onboarding: steps([]),
    contacts: [
      { name: 'Marco Diaz', title: 'CFO', email: 'marco@vela.io', phone: '+1 312 555 0144', champion: true },
      { name: 'Jen Powell', title: 'Travel Manager', email: 'jen@vela.io' },
    ],
    deals: [
      {
        id: 'd_vela_new',
        companyId: 'co_vela',
        name: 'Vela Logistics — new business',
        stage: 'proposal',
        value: 2_100_000,
        probability: 45,
        closeDate: '2026-12-15',
        owner: 'Danil B.',
        createdAt: '2026-10-15',
      },
    ],
    contracts: [],
    tasks: [
      {
        id: 't_vela_1',
        companyId: 'co_vela',
        title: 'Build ROI model for Marco',
        type: 'todo',
        due: '2026-10-23',
        done: false,
        owner: 'Danil B.',
        createdAt: '2026-10-16',
      },
      {
        id: 't_vela_2',
        companyId: 'co_vela',
        title: 'Demo with travel ops team',
        type: 'meeting',
        due: '2026-10-29',
        done: false,
        owner: 'Danil B.',
        createdAt: '2026-10-16',
      },
    ],
    notes: [
      {
        id: 'n_vela_1',
        text: 'Currently on a legacy TMC with high fees. Price-sensitive but big volume — lead with savings.',
        author: 'Danil B.',
        date: '2026-10-16',
      },
    ],
    activity: [{ date: '2026-10-15', text: 'Inbound demo request' }],
  },
  {
    id: 'co_brightside',
    name: 'Brightside Media',
    domain: 'brightside.tv',
    website: 'https://brightside.tv',
    status: 'active',
    industry: 'Media',
    tier: 'Mid-Market',
    employees: 60,
    hq: 'New York, USA',
    accountManager: 'Priya N.',
    annualSpend: 410_000,
    savings: 57_000,
    health: 81,
    nextStep: 'Expansion to contractors',
    createdAt: '2026-05-20',
    onboarding: steps(['kickoff', 'policy', 'integrations', 'invite', 'first_booking']),
    contacts: [{ name: 'Alex Kim', title: 'COO', email: 'alex@brightside.tv', champion: true }],
    deals: [],
    contracts: [],
    tasks: [],
    notes: [],
    activity: [{ date: '2026-10-10', text: 'Expanded to international travel' }],
  },
  {
    id: 'co_quanta',
    name: 'Quanta Labs',
    domain: 'quanta.ai',
    website: 'https://quanta.ai',
    status: 'onboarding',
    industry: 'Technology',
    tier: 'SMB',
    employees: 45,
    hq: 'Boston, USA',
    accountManager: 'Marcus L.',
    annualSpend: 300_000,
    savings: 0,
    health: 64,
    nextStep: 'Connect accounting integration',
    createdAt: '2026-10-08',
    onboarding: steps(['kickoff']),
    contacts: [{ name: 'Lena Park', title: 'Ops Lead', email: 'lena@quanta.ai', champion: true }],
    deals: [],
    contracts: [],
    tasks: [],
    notes: [],
    activity: [{ date: '2026-10-08', text: 'Signed order form' }],
  },
  {
    id: 'co_harbor',
    name: 'Harbor Foods',
    domain: 'harborfoods.com',
    website: 'https://harborfoods.com',
    status: 'lead',
    industry: 'Retail',
    tier: 'Enterprise',
    employees: 500,
    hq: 'Seattle, USA',
    accountManager: 'Danil B.',
    annualSpend: 3_400_000,
    savings: 0,
    health: 48,
    nextStep: 'Qualify budget + authority',
    createdAt: '2026-10-20',
    onboarding: steps([]),
    contacts: [{ name: 'Rob Vance', title: 'VP Ops', email: 'rob@harborfoods.com', champion: true }],
    deals: [
      {
        id: 'd_harbor_new',
        companyId: 'co_harbor',
        name: 'Harbor Foods — new business',
        stage: 'qualify',
        value: 3_400_000,
        probability: 20,
        closeDate: '2027-01-30',
        owner: 'Danil B.',
        createdAt: '2026-10-20',
      },
    ],
    contracts: [],
    tasks: [
      {
        id: 't_harbor_1',
        companyId: 'co_harbor',
        title: 'Discovery call with Rob',
        type: 'call',
        due: '2026-10-26',
        done: false,
        owner: 'Danil B.',
        createdAt: '2026-10-20',
      },
    ],
    notes: [],
    activity: [{ date: '2026-10-20', text: 'Referred by Northwind' }],
  },
];

/* ---------------- derived helpers ---------------- */

export function onboardingPct(c: SalesCompany): number {
  if (!c.onboarding.length) return 0;
  return Math.round(
    (c.onboarding.filter((s) => s.done).length / c.onboarding.length) * 100
  );
}

export function allDeals(companies: SalesCompany[]): Deal[] {
  return companies.flatMap((c) => c.deals);
}

export function allTasks(companies: SalesCompany[]): CrmTask[] {
  return companies.flatMap((c) => c.tasks);
}

export function allContracts(companies: SalesCompany[]): Contract[] {
  return companies.flatMap((c) => c.contracts);
}

/** Probability-weighted value of all open deals (the forecast). */
export function weightedPipeline(deals: Deal[]): number {
  return deals
    .filter(isOpen)
    .reduce((s, d) => s + (d.value * d.probability) / 100, 0);
}

export function openPipeline(deals: Deal[]): number {
  return deals.filter(isOpen).reduce((s, d) => s + d.value, 0);
}

/** New-business ACV won this period. */
export function wonValue(deals: Deal[]): number {
  return deals.filter((d) => d.stage === 'won').reduce((s, d) => s + d.value, 0);
}

export function winRate(deals: Deal[]): number {
  const closed = deals.filter((d) => d.stage === 'won' || d.stage === 'lost');
  if (!closed.length) return 0;
  return Math.round((deals.filter((d) => d.stage === 'won').length / closed.length) * 100);
}

export function healthColor(h: number): 'green' | 'amber' | 'red' {
  if (h >= 75) return 'green';
  if (h >= 55) return 'amber';
  return 'red';
}

export function isOverdue(t: CrmTask, today: string): boolean {
  return !t.done && t.due < today;
}

/**
 * Nova's next-best-action heuristic per account — the kind of nudge a rep
 * would get from a good CRM. Pure function of the account state.
 */
export function nextBestAction(c: SalesCompany, today: string): string {
  const overdue = c.tasks.filter((t) => isOverdue(t, today));
  if (overdue.length) return `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} — clear them to keep momentum.`;
  if (c.status === 'lead' && c.deals.every((d) => d.stage === 'qualify'))
    return 'Still in qualify — book a discovery call and confirm budget + authority.';
  if (c.deals.some((d) => d.stage === 'proposal'))
    return 'Proposal is out — generate the order form so they can sign the moment they say yes.';
  if (c.deals.some((d) => d.stage === 'negotiation'))
    return 'In negotiation — lock the terms and send the contract for signature.';
  if (c.status === 'onboarding' && onboardingPct(c) < 100)
    return `Onboarding ${onboardingPct(c)}% done — finish setup so they can take their first booking.`;
  if (c.status === 'active' && c.health < 70)
    return 'Health is slipping — schedule a check-in before renewal risk builds.';
  if (c.status === 'active') return 'Healthy account — look for an expansion play (new regions, contractors).';
  return 'Log your next step so this account keeps moving.';
}
