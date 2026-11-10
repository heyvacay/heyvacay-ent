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
