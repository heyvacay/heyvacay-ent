'use client';

/**
 * Nova booking management — the internal, platform-wide booking ledger the
 * sales/ops team manages, mirroring heyvacay.co's admin panel exactly: the
 * same fields, statuses, financial columns (net / commission / total),
 * special-request handling and cancellation flow.
 *
 * Data is a deterministic synthetic ledger so the console is rich in the demo;
 * cancellations and special-request toggles persist to localStorage.
 */

import { useCallback, useEffect, useState } from 'react';

export type BookingStatus =
  | 'pending_prebook'
  | 'pending_form'
  | 'processing'
  | 'confirmed'
  | 'cancelled'
  | 'failed'
  | 'modified';

export type RefundStatus = 'pending' | 'processed' | 'failed';

export type CancellationReason =
  | 'user_request'
  | 'payment_failed'
  | 'property_unavailable'
  | 'duplicate_booking'
  | 'fraud_suspected'
  | 'price_mismatch'
  | 'system_error'
  | 'other';

export const CANCELLATION_REASONS: { value: CancellationReason; label: string }[] = [
  { value: 'user_request', label: 'User Request' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'property_unavailable', label: 'Property Unavailable' },
  { value: 'duplicate_booking', label: 'Duplicate Booking' },
  { value: 'fraud_suspected', label: 'Fraud Suspected' },
  { value: 'price_mismatch', label: 'Price Mismatch' },
  { value: 'system_error', label: 'System Error' },
  { value: 'other', label: 'Other' },
];

export interface NovaBooking {
  id: string;
  companyName: string;
  userName: string;
  userEmail: string;
  partnerOrderId: string;
  bookingRef: string;
  hotelName: string;
  regionName: string;
  checkinDate: string; // ISO
  checkoutDate: string; // ISO
  nights: number;
  rooms: number;
  adults: number;
  children: number;
  netAmount: number;
  commissionAmount: number;
  commissionPercent: number;
  totalAmount: number;
  promoCode?: string;
  currency: string;
  status: BookingStatus;
  cancelDeadline?: string;
  cancellationReason?: CancellationReason;
  cancellationComment?: string;
  cancelledAt?: string;
  refundStatus?: RefundStatus;
  refundAmount?: number;
  createdAt: string;
  ratehawkOrderId: string;
  contactEmail: string;
  contactPhone: string;
  /** Special request from the traveler (dietary, late check-in, etc.). */
  userRequest?: string;
  userRequestCompleted?: boolean;
}

/* ---------------- status config (mirrors admin bookingStatusConfig) ---------------- */

export interface StatusUIConfig {
  label: string;
  /** Maps to the ent Badge color palette. */
  color: 'green' | 'amber' | 'slate' | 'brand' | 'red';
  isFinancialDimmed?: boolean;
  hasFinancialLineThrough?: boolean;
  canShowCommission?: boolean;
  canCancel?: boolean;
  showRefundDetails?: boolean;
}

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, StatusUIConfig> = {
  pending_prebook: { label: 'Pending Prebook', color: 'slate', canCancel: true },
  pending_form: { label: 'Pending Form', color: 'slate', canCancel: true },
  processing: { label: 'Processing', color: 'amber', canCancel: true },
  confirmed: { label: 'Confirmed', color: 'green', canShowCommission: true, canCancel: true },
  modified: { label: 'Modified', color: 'brand', canShowCommission: true, canCancel: true },
  cancelled: {
    label: 'Cancelled',
    color: 'red',
    isFinancialDimmed: true,
    hasFinancialLineThrough: true,
    canShowCommission: true,
    showRefundDetails: true,
  },
  failed: {
    label: 'Failed',
    color: 'red',
    isFinancialDimmed: true,
    hasFinancialLineThrough: true,
    canShowCommission: true,
    showRefundDetails: true,
  },
};

export function statusConfig(status: BookingStatus): StatusUIConfig {
  return BOOKING_STATUS_CONFIG[status] ?? { label: status, color: 'slate' };
}

export function currencySymbol(currency?: string): string {
  if (!currency) return '';
  return currency.toUpperCase() === 'USD' ? '$' : currency.toUpperCase();
}

/* ---------------- deterministic seed ---------------- */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMPANIES = [
  'Northwind Robotics',
  'Lumen Health',
  'Vela Logistics',
  'Brightside Media',
  'Quanta Labs',
  'Harbor Foods',
];
const FIRST = ['Dana', 'Sam', 'Alex', 'Lena', 'Rob', 'Maya', 'Chris', 'Nina', 'Omar', 'Priya', 'Jordan', 'Tess'];
const LAST = ['Okoro', 'Lee', 'Kim', 'Park', 'Vance', 'Singh', 'Nguyen', 'Diaz', 'Cole', 'Ahmed', 'Reyes', 'Novak'];
const HOTELS: { name: string; region: string }[] = [
  { name: 'The Standard High Line', region: 'New York, US' },
  { name: 'Hotel Zephyr', region: 'San Francisco, US' },
  { name: 'The LINE Austin', region: 'Austin, US' },
  { name: 'The Hoxton Shoreditch', region: 'London, UK' },
  { name: 'Roomers Frankfurt', region: 'Frankfurt, DE' },
  { name: 'Le Pigalle', region: 'Paris, FR' },
  { name: 'Park Hotel Tokyo', region: 'Tokyo, JP' },
  { name: 'Rove Downtown', region: 'Dubai, AE' },
];
const STATUSES: BookingStatus[] = [
  'confirmed',
  'confirmed',
  'confirmed',
  'confirmed',
  'processing',
  'pending_form',
  'modified',
  'cancelled',
  'failed',
];
const PROMOS = [undefined, undefined, undefined, 'WELCOME10', 'TEAM5', undefined, 'SUMMER'];
const REQUESTS = [
  undefined,
  undefined,
  undefined,
  'Late check-in, arriving ~11pm',
  'High floor, away from elevator',
  'Early check-in if possible',
  'Twin beds, not a king',
  'Gluten-free breakfast',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Build the full synthetic ledger (deterministic). */
export function seedNovaBookings(): NovaBooking[] {
  const rnd = mulberry32(7);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const out: NovaBooking[] = [];
  for (let i = 0; i < 46; i++) {
    const company = pick(COMPANIES);
    const first = pick(FIRST);
    const last = pick(LAST);
    const name = `${first} ${last}`;
    const domain = company.toLowerCase().replace(/[^a-z]+/g, '') + '.com';
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;
    const hotel = pick(HOTELS);
    const status = pick(STATUSES);
    const nights = 1 + Math.floor(rnd() * 5);
    const rooms = 1 + Math.floor(rnd() * 2);
    const year = 2025 + Math.floor(rnd() * 2);
    const mo = 1 + Math.floor(rnd() * 12);
    const day = 1 + Math.floor(rnd() * 26);
    const checkin = `${year}-${pad(mo)}-${pad(day)}`;
    const coDay = Math.min(day + nights, 28);
    const checkout = `${year}-${pad(mo)}-${pad(coDay)}`;
    const nightly = 160 + Math.floor(rnd() * 420);
    const net = nightly * nights * rooms;
    const commissionPercent = 8 + Math.floor(rnd() * 8); // 8–15%
    const commissionAmount = Math.round(net * (commissionPercent / 100) * 100) / 100;
    const promo = pick(PROMOS);
    const discount = promo ? Math.round(net * 0.05) : 0;
    const total = net - discount;
    const cmo = mo === 1 ? 12 : mo - 1;
    const cyear = mo === 1 ? year - 1 : year;
    const createdAt = `${cyear}-${pad(cmo)}-${pad(1 + Math.floor(rnd() * 26))}`;
    const req = pick(REQUESTS);
    const cancelled = status === 'cancelled' || status === 'failed';
    out.push({
      id: `nbk_${i}`,
      companyName: company,
      userName: name,
      userEmail: email,
      partnerOrderId: `PO-${100000 + i * 37}`,
      bookingRef: `HV${year}${pad(mo)}${1000 + i}`,
      hotelName: hotel.name,
      regionName: hotel.region,
      checkinDate: checkin,
      checkoutDate: checkout,
      nights,
      rooms,
      adults: rooms + Math.floor(rnd() * 2),
      children: Math.floor(rnd() * 2),
      netAmount: net,
      commissionAmount,
      commissionPercent,
      totalAmount: total,
      promoCode: promo,
      currency: 'USD',
      status,
      cancelDeadline: checkin,
      refundStatus: cancelled ? (rnd() > 0.5 ? 'processed' : 'pending') : undefined,
      refundAmount: cancelled ? Math.round(total * 0.9) : undefined,
      cancellationReason: status === 'cancelled' ? 'user_request' : status === 'failed' ? 'payment_failed' : undefined,
      cancelledAt: cancelled ? createdAt : undefined,
      createdAt,
      ratehawkOrderId: `RH-${year}-${200000 + i * 53}`,
      contactEmail: email,
      contactPhone: `+1 555 ${pad(Math.floor(rnd() * 99))} ${1000 + i}`,
      userRequest: req,
      userRequestCompleted: req ? rnd() > 0.5 : undefined,
    });
  }
  // Newest first.
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/* ---------------- persistence hook ---------------- */

const KEY = 'hv_nova_bookings_v1';

type Overrides = Record<
  string,
  Partial<
    Pick<
      NovaBooking,
      | 'status'
      | 'cancellationReason'
      | 'cancellationComment'
      | 'cancelledAt'
      | 'refundStatus'
      | 'refundAmount'
      | 'userRequestCompleted'
    >
  >
>;

export function useNovaBookings() {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setOverrides(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const persist = useCallback((next: Overrides) => {
    setOverrides(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const base = seedNovaBookings();
  const bookings: NovaBooking[] = base.map((b) =>
    overrides[b.id] ? { ...b, ...overrides[b.id] } : b
  );

  const cancelBooking = useCallback(
    (id: string, reason: CancellationReason, comment?: string, refundAmount?: number) => {
      const b = base.find((x) => x.id === id);
      persist({
        ...overrides,
        [id]: {
          ...overrides[id],
          status: 'cancelled',
          cancellationReason: reason,
          cancellationComment: comment,
          cancelledAt: new Date().toISOString().slice(0, 10),
          refundStatus: 'pending',
          refundAmount:
            refundAmount != null ? refundAmount : b ? Math.round(b.totalAmount * 0.9) : undefined,
        },
      });
    },
    [overrides, persist, base]
  );

  const toggleRequestCompleted = useCallback(
    (id: string, completed: boolean) => {
      persist({ ...overrides, [id]: { ...overrides[id], userRequestCompleted: completed } });
    },
    [overrides, persist]
  );

  return { bookings, loaded, cancelBooking, toggleRequestCompleted };
}
