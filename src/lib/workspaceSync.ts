'use client';

import type { AppState } from '@/lib/types';

export type SyncRole = 'admin' | 'booker' | 'employee';

export interface WorkspacePayload {
  state: AppState;
  role: SyncRole;
}

/** Load a company's shared workspace from the server. null = none yet / offline. */
export async function fetchWorkspace(companyId: string): Promise<WorkspacePayload | null> {
  try {
    const res = await fetch(`/api/workspace?companyId=${encodeURIComponent(companyId)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: WorkspacePayload | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

/** Persist a company's workspace to the server (best-effort). */
export async function pushWorkspace(
  companyId: string,
  state: AppState,
  role: SyncRole
): Promise<boolean> {
  try {
    const res = await fetch('/api/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, state, role }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ----------------------------- events ----------------------------- */

/** Load a company's events from the shared store. null = offline/none. */
export async function fetchEvents<T>(companyId: string): Promise<T[] | null> {
  try {
    const res = await fetch(`/api/workspace/events?companyId=${encodeURIComponent(companyId)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { events?: T[] };
    return Array.isArray(json.events) ? json.events : null;
  } catch {
    return null;
  }
}

export async function pushEvents<T>(companyId: string, events: T[]): Promise<boolean> {
  try {
    const res = await fetch('/api/workspace/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, events }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------ CRM ------------------------------- */

export interface CrmPayload<C, R> {
  companies: C[];
  reps: R[];
  commission: unknown;
  commissionApprovals: unknown[];
}

/** Load the shared CRM book. null = nothing stored yet / offline. */
export async function fetchCrm<C, R>(): Promise<CrmPayload<C, R> | null> {
  try {
    const res = await fetch('/api/crm', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: CrmPayload<C, R> | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function pushCrm<C, R>(payload: CrmPayload<C, R>): Promise<boolean> {
  try {
    const res = await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* -------------------------- access audit -------------------------- */

export interface AccessLogEntry {
  id: string;
  companyId: string;
  companyName: string;
  repName: string;
  reason: string;
  comment?: string;
  at: string;
}

/** Record a rep entering a customer account (internal audit log). */
export async function logAccountAccess(input: {
  companyId: string;
  companyName: string;
  repName: string;
  reason: string;
  comment?: string;
}): Promise<AccessLogEntry | null> {
  try {
    const res = await fetch('/api/audit/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      keepalive: true,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { entry?: AccessLogEntry };
    return json.entry ?? null;
  } catch {
    return null;
  }
}

/** Read the access history for one company (or all when omitted). */
export async function fetchAccessLog(companyId?: string): Promise<AccessLogEntry[]> {
  try {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    const res = await fetch(`/api/audit/access${qs}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as { entries?: AccessLogEntry[] };
    return Array.isArray(json.entries) ? json.entries : [];
  } catch {
    return [];
  }
}
