/**
 * Nova — HeyVacay's internal ops console data.
 *
 * This is cross-tenant, HeyVacay-staff-only data (the portfolio of enterprise
 * customers, platform revenue, and the ops queue). It's separate from the
 * per-company customer store. Today it's seeded demo data; it becomes the
 * enterprise back-office API once the backend is stood up.
 */

export type NovaStatus = 'active' | 'trial' | 'onboarding' | 'paused';
export type NovaHealth = 'healthy' | 'watch' | 'risk';

export interface NovaCompany {
  id: string;
  name: string;
  industry: string;
  employees: number;
  status: NovaStatus;
  health: NovaHealth;
  csm: string;
  joined: string;
  /** monthly travel GMV booked through HeyVacay */
  gmv: number;
  /** monthly savings delivered to the company vs market */
  savings: number;
  /** monthly HeyVacay commission revenue from suppliers */
  commission: number;
}

export const NOVA_COMPANIES: NovaCompany[] = [
  { id: 'c_hooli', name: 'Hooli', industry: 'Technology', employees: 2200, status: 'active', health: 'healthy', csm: 'Dana K.', joined: '2026-02-11', gmv: 880000, savings: 128000, commission: 76000 },
  { id: 'c_umbrella', name: 'Umbrella Health', industry: 'Healthcare', employees: 1200, status: 'active', health: 'watch', csm: 'Marcus L.', joined: '2026-03-02', gmv: 520000, savings: 74000, commission: 44000 },
  { id: 'c_acme', name: 'Acme Industries', industry: 'Manufacturing', employees: 540, status: 'active', health: 'healthy', csm: 'Dana K.', joined: '2026-01-20', gmv: 310000, savings: 46000, commission: 28000 },
  { id: 'c_stark', name: 'Stark Materials', industry: 'Industrial', employees: 330, status: 'active', health: 'healthy', csm: 'Priya N.', joined: '2026-04-09', gmv: 198000, savings: 29000, commission: 17500 },
  { id: 'c_initech', name: 'Initech', industry: 'Fintech', employees: 210, status: 'active', health: 'healthy', csm: 'Marcus L.', joined: '2026-05-14', gmv: 140000, savings: 21000, commission: 12600 },
  { id: 'c_northwind', name: 'Northwind Robotics', industry: 'Robotics', employees: 120, status: 'active', health: 'healthy', csm: 'Priya N.', joined: '2026-06-01', gmv: 82000, savings: 12400, commission: 7800 },
  { id: 'c_wayne', name: 'Wayne Logistics', industry: 'Logistics', employees: 760, status: 'onboarding', health: 'healthy', csm: 'Dana K.', joined: '2026-09-28', gmv: 61000, savings: 8800, commission: 5200 },
  { id: 'c_soylent', name: 'Soylent Foods', industry: 'CPG', employees: 150, status: 'active', health: 'risk', csm: 'Marcus L.', joined: '2026-03-19', gmv: 44000, savings: 6200, commission: 3700 },
  { id: 'c_globex', name: 'Globex', industry: 'SaaS', employees: 85, status: 'trial', health: 'watch', csm: 'Priya N.', joined: '2026-10-01', gmv: 24000, savings: 3600, commission: 2100 },
  { id: 'c_piedpiper', name: 'Pied Piper', industry: 'Startup', employees: 42, status: 'trial', health: 'watch', csm: 'Dana K.', joined: '2026-10-07', gmv: 9000, savings: 1300, commission: 760 },
];

export interface NovaOpsItem {
  id: string;
  company: string;
  text: string;
  severity: 'risk' | 'watch' | 'info';
}

export const NOVA_OPS: NovaOpsItem[] = [
  { id: 'op_1', company: 'Soylent Foods', text: 'Bookings down 42% MoM — churn risk, no exec sponsor engaged', severity: 'risk' },
  { id: 'op_2', company: 'Umbrella Health', text: 'Approval SLA breached on 3 trips this week', severity: 'watch' },
  { id: 'op_3', company: 'Globex', text: 'Trial ends in 3 days — zero bookings so far', severity: 'watch' },
  { id: 'op_4', company: 'Pied Piper', text: 'Onboarding stalled at the integrations step for 5 days', severity: 'watch' },
  { id: 'op_5', company: 'Acme Industries', text: 'QuickBooks token needs re-authorization', severity: 'info' },
  { id: 'op_6', company: 'Wayne Logistics', text: 'Roster sync from BambooHR ready to enable', severity: 'info' },
];

const now = new Date();
export const NOVA_MONTHS = Array.from({ length: 6 }).map((_, i) =>
  new Date(now.getFullYear(), now.getMonth() - 5 + i, 1).toLocaleDateString(
    'en-US',
    { month: 'short' }
  )
);

export const totals = {
  companies: NOVA_COMPANIES.length,
  travelers: NOVA_COMPANIES.reduce((s, c) => s + c.employees, 0),
  gmv: NOVA_COMPANIES.reduce((s, c) => s + c.gmv, 0),
  commission: NOVA_COMPANIES.reduce((s, c) => s + c.commission, 0),
  savings: NOVA_COMPANIES.reduce((s, c) => s + c.savings, 0),
};

/** Build a rising 6-month trail that ends at `total` (this month). */
function trail(total: number): number[] {
  return [0.58, 0.67, 0.76, 0.85, 0.92, 1].map((f) => Math.round(total * f));
}

export const NOVA_GMV_SERIES = trail(totals.gmv);
export const NOVA_COMMISSION_SERIES = trail(totals.commission);
