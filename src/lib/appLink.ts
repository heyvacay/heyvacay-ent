'use client';

import { useEffect, useState } from 'react';

/**
 * CRM ↔ customer-workspace link.
 *
 * The Nova CRM and the customer app keep separate browser stores. For the
 * company that is actually provisioned in this browser's workspace (ids match),
 * we read the real booking data out of the app store so the CRM shows ACTUAL
 * savings / spend / bookings instead of seeded numbers. When a real backend is
 * live this becomes a server read with the same shape.
 */

const APP_KEY = 'hv_ent_demo_v2';

export interface LinkedBooking {
  title: string;
  price: number;
  savings: number;
  startDate: string;
  status: string;
  type: string;
}

export interface LinkedStats {
  bookings: number;
  savings: number;
  spend: number;
  recent: LinkedBooking[];
  /** Net-30 request raised by the company admin, if any. */
  netRequested: boolean;
  billingMode?: string;
  /** Net-30 KYC status, if a rep has started setup. */
  netKycStatus?: 'sent' | 'submitted' | 'approved';
}

export function readAppLink(companyId: string): LinkedStats | null {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    if (!state?.company || state.company.id !== companyId) return null;
    const all = Array.isArray(state.bookings) ? state.bookings : [];
    const live = all.filter((b: { status?: string }) => b.status !== 'cancelled');
    const savings = live.reduce((s: number, b: { savings?: number }) => s + (b.savings || 0), 0);
    const spend = live.reduce((s: number, b: { price?: number }) => s + (b.price || 0), 0);
    const recent: LinkedBooking[] = live
      .slice(0, 8)
      .map((b: Record<string, unknown>) => ({
        title: String(b.title ?? ''),
        price: Number(b.price ?? 0),
        savings: Number(b.savings ?? 0),
        startDate: String(b.startDate ?? ''),
        status: String(b.status ?? ''),
        type: String(b.type ?? ''),
      }));
    const billing = state.billing ?? {};
    return {
      bookings: live.length,
      savings,
      spend,
      recent,
      netRequested: Boolean(billing.netRequested),
      billingMode: billing.mode,
      netKycStatus: billing.netKyc?.status,
    };
  } catch {
    return null;
  }
}

export interface WorkspaceSnapshot {
  company: { id: string; name: string; domain: string };
  users: { id: string; name: string; email: string; department: string; title: string; role: string }[];
  bookings: {
    id: string;
    travelerId: string;
    title: string;
    detail: string;
    type: string;
    startDate: string;
    endDate: string;
    price: number;
    savings: number;
    status: string;
    destination?: string;
    roomType?: string;
  }[];
}

/** Full workspace snapshot for the support console (Nova). */
export function readWorkspace(): WorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw)?.state;
    if (!state?.company) return null;
    return {
      company: state.company,
      users: Array.isArray(state.users) ? state.users : [],
      bookings: Array.isArray(state.bookings) ? state.bookings : [],
    };
  } catch {
    return null;
  }
}

export function useWorkspace(): WorkspaceSnapshot | null {
  const [snap, setSnap] = useState<WorkspaceSnapshot | null>(null);
  useEffect(() => {
    const read = () => setSnap(readWorkspace());
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);
  return snap;
}

/** Live-updating version — re-reads when the app store changes. */
export function useAppLink(companyId: string): LinkedStats | null {
  const [stats, setStats] = useState<LinkedStats | null>(null);
  useEffect(() => {
    const read = () => setStats(readAppLink(companyId));
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, [companyId]);
  return stats;
}
