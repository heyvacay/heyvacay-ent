'use client';

/**
 * Manual / on-demand invoices generated from the CRM Invoicing Center.
 *
 * The period invoices in `invoicing.ts` are auto-built from a company's
 * confirmed bookings every 30 days. These are different: a rep composes one on
 * demand — any time, for any amount (including $0) — with custom line items for
 * charges that don't come from a booking (airline change fees, hotel incidentals,
 * support/service charges, etc.). They can also fold in a period's booking lines.
 *
 * Persisted per company under `hv_crm_manual_invoices_<companyId>` so they show
 * alongside the period invoices and can be re-printed or marked paid later.
 */

export const LINE_CATEGORIES = [
  'Travel booking',
  'Airline incurred charges',
  'Hotel incurred charges',
  'Support charges',
  'Service fee',
  'Discount',
  'Other',
] as const;

export type LineCategory = (typeof LINE_CATEGORIES)[number];

export interface ManualLineItem {
  id: string;
  category: LineCategory;
  description: string;
  quantity: number;
  /** Unit amount in dollars. May be negative (e.g. a discount/credit). */
  unitAmount: number;
}

export interface ManualInvoice {
  id: string;
  companyId: string;
  number: string;
  billTo: string;
  issued: string; // YYYY-MM-DD
  due: string; // YYYY-MM-DD
  items: ManualLineItem[];
  taxRatePct: number; // applied to taxable positive lines
  notes?: string;
  poNumber?: string;
  subtotal: number;
  tax: number;
  total: number;
  paid: boolean;
  createdBy: string;
  createdAt: string; // ISO
}

const key = (companyId: string) => `hv_crm_manual_invoices_${companyId}`;

export function lineAmount(l: Pick<ManualLineItem, 'quantity' | 'unitAmount'>): number {
  return Math.round((Number(l.quantity) || 0) * (Number(l.unitAmount) || 0) * 100) / 100;
}

/** Totals for a draft set of items + tax rate. Tax applies to positive lines only. */
export function computeTotals(
  items: Pick<ManualLineItem, 'quantity' | 'unitAmount'>[],
  taxRatePct: number
): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((s, l) => s + lineAmount(l), 0);
  const taxable = items.reduce((s, l) => {
    const amt = lineAmount(l);
    return amt > 0 ? s + amt : s;
  }, 0);
  const tax = Math.round(taxable * ((Number(taxRatePct) || 0) / 100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}

export function listManualInvoices(companyId: string): ManualInvoice[] {
  try {
    const raw = localStorage.getItem(key(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ManualInvoice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(companyId: string, list: ManualInvoice[]) {
  try {
    localStorage.setItem(key(companyId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Next sequential display number for a company, e.g. "INV-0003". */
export function nextManualNumber(companyId: string): string {
  const n = listManualInvoices(companyId).length + 1;
  return `INV-${String(n).padStart(4, '0')}`;
}

export function saveManualInvoice(inv: ManualInvoice): ManualInvoice {
  const list = listManualInvoices(inv.companyId);
  const idx = list.findIndex((x) => x.id === inv.id);
  const next = idx >= 0 ? list.map((x) => (x.id === inv.id ? inv : x)) : [inv, ...list];
  writeAll(inv.companyId, next);
  return inv;
}

export function setManualInvoicePaid(companyId: string, id: string, paid: boolean) {
  const list = listManualInvoices(companyId).map((x) => (x.id === id ? { ...x, paid } : x));
  writeAll(companyId, list);
}

export function deleteManualInvoice(companyId: string, id: string) {
  writeAll(companyId, listManualInvoices(companyId).filter((x) => x.id !== id));
}
