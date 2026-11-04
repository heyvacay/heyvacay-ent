'use client';

/**
 * CRM-side access to a customer's isolated workspace. Each entered company
 * persists its traveler-app state under `hv_ent_acct_<companyId>` (see the
 * store). The CRM Invoicing Center reads that to show a company's Net 30 / KYC
 * status and invoices, and writes back to send / review / approve the KYC
 * without a rep having to enter the workspace.
 */

import { SEED } from './seed';
import { todayISO } from './format';
import type { AppState, Billing, KycStatus, Role } from './types';

const acctKey = (id: string) => `hv_ent_acct_${id}`;

export function readAccountState(companyId: string): AppState | null {
  try {
    const raw = localStorage.getItem(acctKey(companyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: AppState };
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

function writeAccountState(companyId: string, state: AppState, role: Role = 'admin') {
  try {
    localStorage.setItem(acctKey(companyId), JSON.stringify({ state, role }));
    // Nudge any open workspace tab for this account to reload.
    window.dispatchEvent(new Event('hv-view-as-change'));
  } catch {
    /* ignore */
  }
}

/** Load the account, seeding a fresh isolated workspace if none exists yet. */
export function ensureAccount(
  companyId: string,
  identity: { name: string; domain?: string }
): AppState {
  const existing = readAccountState(companyId);
  if (existing) return existing;
  const seeded: AppState = {
    ...SEED,
    company: {
      ...SEED.company,
      id: companyId,
      name: identity.name,
      domain: identity.domain || SEED.company.domain,
    },
    bookings: [],
    expenses: [],
    points: [],
  };
  writeAccountState(companyId, seeded);
  return seeded;
}

/** True when this company has an approved Net 30 (invoiced billing live). */
export function isNet30Approved(state: AppState | null): boolean {
  return state?.billing?.netKyc?.status === 'approved';
}

/** Send the KYC application to the account owner (creates the workspace if new). */
export function crmSendKyc(
  companyId: string,
  identity: { name: string; domain?: string },
  repName: string
): AppState {
  const s = ensureAccount(companyId, identity);
  const owner =
    s.users.find((u) => u.role === 'admin' && u.superAdmin) ??
    s.users.find((u) => u.role === 'admin') ??
    s.users[0];
  const next: AppState = {
    ...s,
    billing: {
      ...(s.billing ?? ({ mode: 'employee' } as Billing)),
      netRequested: true,
      netKyc: {
        status: 'sent',
        rep: repName,
        ownerName: owner?.name ?? identity.name,
        ownerEmail: owner?.email ?? '',
        sentAt: todayISO(),
      },
    },
  };
  writeAccountState(companyId, next);
  return next;
}

/** Move the KYC through review from the CRM. On 'approved', Net 30 goes live. */
export function crmSetKycStatus(
  companyId: string,
  status: KycStatus,
  reviewer: string,
  comment?: string
): AppState | null {
  const s = readAccountState(companyId);
  if (!s) return null;
  const prev = s.billing?.netKyc;
  if (!prev) return null;
  const now = todayISO();
  const approved = status === 'approved';
  const next: AppState = {
    ...s,
    billing: {
      ...(s.billing ?? ({ mode: 'employee' } as Billing)),
      ...(approved ? { mode: 'net30' as Billing['mode'] } : {}),
      netKyc: {
        ...prev,
        status,
        reviewer,
        reviewComment: status === 'needs_attention' ? comment : undefined,
        ...(approved ? { approvedAt: now } : {}),
        history: [...(prev.history ?? []), { status, at: now, by: reviewer, comment }],
      },
    },
  };
  writeAccountState(companyId, next);
  return next;
}

/** Per-company, per-period "payment recorded" flag the rep sets from the CRM. */
const crmPaidKey = (companyId: string, period: string) =>
  `hv_crm_invoice_paid_${companyId}_${period}`;

export function crmInvoicePaid(companyId: string, period: string): boolean {
  try {
    return localStorage.getItem(crmPaidKey(companyId, period)) === '1';
  } catch {
    return false;
  }
}

export function crmRecordInvoicePaid(companyId: string, period: string, paid: boolean) {
  try {
    if (paid) localStorage.setItem(crmPaidKey(companyId, period), '1');
    else localStorage.removeItem(crmPaidKey(companyId, period));
  } catch {
    /* ignore */
  }
}
