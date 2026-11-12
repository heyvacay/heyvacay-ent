'use client';

import { useEffect, useState } from 'react';
import { fetchWorkspace } from '@/lib/workspaceSync';

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

/** Derive CRM-facing stats from a workspace AppState (local or server). */
function statsFromState(state: {
  bookings?: unknown;
  billing?: { netRequested?: boolean; mode?: string; netKyc?: { status?: string } };
}): LinkedStats {
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
    netKycStatus: billing.netKyc?.status as LinkedStats['netKycStatus'],
  };
}

export function readAppLink(companyId: string): LinkedStats | null {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw)?.state;
    if (!state?.company || state.company.id !== companyId) return null;
    return statsFromState(state);
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

/**
 * Live CRM stats for a company. Reads this browser's workspace first (instant
 * when a rep already has that company loaded), then overlays the authoritative
 * server workspace by companyId — so the CRM shows a company's REAL spend /
 * savings / bookings on any device, for any provisioned account, not just the
 * one currently open in this browser.
 */
export function useAppLink(companyId: string): LinkedStats | null {
  const [stats, setStats] = useState<LinkedStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Fast path: same-browser localStorage (don't clobber a server result with null).
    const readLocal = () => setStats((prev) => readAppLink(companyId) ?? prev);
    readLocal();
    window.addEventListener('storage', readLocal);
    // Authoritative cross-device read from the shared server workspace.
    fetchWorkspace(companyId)
      .then((wp) => {
        if (cancelled || !wp?.state?.company) return;
        if (wp.state.company.id && wp.state.company.id !== companyId) return;
        setStats(statsFromState(wp.state));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener('storage', readLocal);
    };
  }, [companyId]);
  return stats;
}
