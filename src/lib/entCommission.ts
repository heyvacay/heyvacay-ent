/**
 * Client-side bridge between the CRM commission config and the booking markup.
 *
 * The enterprise backend returns NET (0-commission) prices for our channel; the
 * app then marks them up by HeyVacay's commission before showing/charging. That
 * commission is NOT a flat number — it lives in the Nova CRM (global per-star
 * rates + region/hotel overrides, with optional per-company custom schedules).
 *
 * The CRM store persists to localStorage, so we read it synchronously here and
 * resolve the effective percent for the hotel being booked (its star tier, plus
 * the workspace's active company). No network, no React — safe to call from the
 * plain search lib. Falls back to the CRM defaults when nothing is persisted, so
 * it is always CRM-driven, never a hard-coded 10%.
 */
'use client';

import {
  DEFAULT_COMMISSION,
  resolveCommissionPercent,
  type CommissionState,
  type SalesCompany,
} from './crm';

// Must match the keys the stores write to (crmStore.tsx / store.tsx).
const CRM_COMMISSION_KEY = 'hv_crm_commission_v1';
const CRM_COMPANIES_KEY = 'hv_crm_demo_v2';
const APP_STORE_KEY = 'hv_ent_demo_v2';
const VIEW_AS_KEY = 'hv_view_as_ctx';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readCommission(): CommissionState {
  if (typeof window === 'undefined') return DEFAULT_COMMISSION;
  const parsed = safeParse<CommissionState>(localStorage.getItem(CRM_COMMISSION_KEY));
  return parsed?.starRules ? parsed : DEFAULT_COMMISSION;
}

function readCompanies(): SalesCompany[] {
  if (typeof window === 'undefined') return [];
  const parsed = safeParse<SalesCompany[]>(localStorage.getItem(CRM_COMPANIES_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Identify which CRM company this workspace is booking for, so a company on its
 * own commission schedule is honored. Precedence: an active "view as" account
 * (Nova impersonation), then the signed-in workspace's company — matched to a
 * CRM record by id first, then domain. Null when there's no match (global rates
 * apply).
 */
function readActiveCompany(companies: SalesCompany[]): SalesCompany | null {
  if (typeof window === 'undefined' || companies.length === 0) return null;

  const byId = (id?: string | null) =>
    id ? companies.find((c) => c.id === id) ?? null : null;
  const byDomain = (domain?: string | null) =>
    domain
      ? companies.find(
          (c) => c.domain && c.domain.toLowerCase() === domain.toLowerCase()
        ) ?? null
      : null;

  // 1. Nova "view as" overlay (sessionStorage), if present.
  const viewAs = safeParse<{ id?: string; domain?: string }>(
    sessionStorage.getItem(VIEW_AS_KEY)
  );
  if (viewAs) {
    const m = byId(viewAs.id) ?? byDomain(viewAs.domain);
    if (m) return m;
  }

  // 2. The signed-in workspace's own company.
  const app = safeParse<{ state?: { company?: { id?: string; domain?: string } } }>(
    localStorage.getItem(APP_STORE_KEY)
  );
  const co = app?.state?.company;
  return byId(co?.id) ?? byDomain(co?.domain);
}

/**
 * Effective HeyVacay commission percent for a hotel, from the CRM. `star` is the
 * hotel's star rating; `hid`/`regionId` let hotel/region overrides win.
 */
export function activeCommissionPercent(opts: {
  star?: number | null;
  hid?: number | null;
  regionId?: number | null;
}): number {
  const commission = readCommission();
  const company = readActiveCompany(readCompanies());
  return resolveCommissionPercent(commission, { ...opts, company });
}

/**
 * The same, expressed as a multiplicative markup factor for net→customer price
 * (e.g. 12% → 1.12). Clamped to >= 1 so a stray negative rule can never discount
 * below net.
 */
export function entMarkupFactor(opts: {
  star?: number | null;
  hid?: number | null;
  regionId?: number | null;
}): number {
  const pct = activeCommissionPercent(opts);
  const factor = 1 + (Number.isFinite(pct) ? pct : 0) / 100;
  return factor >= 1 ? factor : 1;
}
