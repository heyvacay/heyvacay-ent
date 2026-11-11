'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import type { Expense } from '@/lib/types';

/**
 * Background engine that keeps the accounting system (QuickBooks / Xero) in
 * lock-step with expense approvals — no button pressing required.
 *
 * Per connected accounting provider it reads two admin settings (saved by
 * AccountingSyncPanel, per company + provider):
 *   • posting mode  — on_approval (default) | on_submit | manual
 *   • posting scope — all | company | personal
 *
 * Then, on any change to the expense list, it:
 *   1. POSTS newly-eligible expenses (approved, or also submitted in on_submit
 *      mode) that aren't synced yet, honoring the scope filter.
 *   2. REMOVES expenses that were posted but have since been rejected — pulling
 *      them back out of the accounting system — so a rejected expense never
 *      lingers in the books.
 *
 * Posting and deletion are both idempotent server-side (stable HeyVacay
 * reference / DocNumber), so running this from more than one admin tab is safe.
 * Runs admin-only; employees never trigger company-wide accounting writes.
 */

/** Providers with real sync + unsync routes wired. */
const AUTO_PROVIDERS = ['quickbooks', 'xero'] as const;
type Provider = (typeof AUTO_PROVIDERS)[number];
type PostMode = 'on_approval' | 'on_submit' | 'manual';
type PostScope = 'all' | 'company' | 'personal';

/** Don't re-hit the same expense+action more often than this (ms). */
const COOLDOWN_MS = 45_000;
/** Safety-net sweep interval (ms) — catches cross-device status changes. */
const SWEEP_MS = 60_000;

function readMode(companyId: string, provider: string): PostMode {
  try {
    const v = localStorage.getItem(`hv_post_mode_${companyId}_${provider}`);
    if (v === 'on_approval' || v === 'on_submit' || v === 'manual') return v;
  } catch {
    /* ignore */
  }
  return 'on_approval';
}

function readScope(companyId: string, provider: string): PostScope {
  try {
    const v = localStorage.getItem(`hv_post_scope_${companyId}_${provider}`);
    if (v === 'all' || v === 'company' || v === 'personal') return v;
  } catch {
    /* ignore */
  }
  return 'all';
}

function inScope(e: Expense, scope: PostScope): boolean {
  const personal = e.paidWith === 'personal' || e.reimbursable;
  if (scope === 'company') return !personal;
  if (scope === 'personal') return !!personal;
  return true;
}

export function AccountingAutoSync() {
  const { state, role, syncExpense, markExpenseUnsynced } = useStore();
  const companyId = state.company.id;
  const expenses = state.expenses;
  const integrations = state.integrations;

  // Last-attempt timestamps keyed `${provider}:${action}:${id}` — avoids
  // hammering a provider that's mid-setup or rate-limiting.
  const attempts = useRef<Map<string, number>>(new Map());
  const running = useRef(false);

  const connectedAutoProviders = useCallback((): Provider[] => {
    return AUTO_PROVIDERS.filter((p) =>
      integrations.some((i) => i.id === p && i.status === 'connected')
    );
  }, [integrations]);

  const shouldAttempt = (key: string): boolean => {
    const last = attempts.current.get(key);
    return !last || Date.now() - last > COOLDOWN_MS;
  };

  const run = useCallback(async () => {
    if (role !== 'admin' || running.current) return;
    const providers = connectedAutoProviders();
    if (!providers.length) return;

    running.current = true;
    try {
      for (const provider of providers) {
        const mode = readMode(companyId, provider);

        // --- Expenses to POST ------------------------------------------
        if (mode !== 'manual') {
          const scope = readScope(companyId, provider);
          const toPost = expenses.filter((e) => {
            if (e.synced) return false;
            const eligible =
              e.status === 'approved' ||
              e.status === 'reimbursed' ||
              (mode === 'on_submit' && e.status === 'submitted');
            if (!eligible) return false;
            if (!inScope(e, scope)) return false;
            return shouldAttempt(`${provider}:post:${e.id}`);
          });
          if (toPost.length) {
            for (const e of toPost) attempts.current.set(`${provider}:post:${e.id}`, Date.now());
            try {
              const res = await fetch(`/api/integrations/${provider}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyId,
                  expenses: toPost.map((e) => ({
                    id: e.id,
                    merchant: e.merchant,
                    category: e.category,
                    amount: e.amount,
                    date: e.date,
                    note: e.note,
                    paidWith: e.paidWith,
                  })),
                }),
              });
              if (res.ok) {
                const data = await res.json();
                for (const r of (data.results || []) as Array<{ id: string; ok: boolean }>) {
                  if (r.ok) syncExpense(r.id);
                }
              }
            } catch {
              /* transient — cooldown will allow a retry */
            }
          }
        }

        // --- Expenses to REMOVE (posted, then rejected) ----------------
        const toRemove = expenses.filter(
          (e) => e.synced && e.status === 'rejected' && shouldAttempt(`${provider}:unsync:${e.id}`)
        );
        if (toRemove.length) {
          for (const e of toRemove) attempts.current.set(`${provider}:unsync:${e.id}`, Date.now());
          try {
            const res = await fetch(`/api/integrations/${provider}/unsync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ companyId, expenseIds: toRemove.map((e) => e.id) }),
            });
            if (res.ok) {
              const data = await res.json();
              for (const r of (data.results || []) as Array<{ id: string; ok: boolean }>) {
                if (r.ok) markExpenseUnsynced(r.id);
              }
            }
          } catch {
            /* transient — cooldown will allow a retry */
          }
        }
      }
    } finally {
      running.current = false;
    }
  }, [role, companyId, expenses, integrations, connectedAutoProviders, syncExpense, markExpenseUnsynced]);

  // React to expense/integration changes, settings changes, and a slow sweep.
  useEffect(() => {
    void run();
    const onSettings = () => void run();
    window.addEventListener('hv-post-mode-changed', onSettings);
    window.addEventListener('storage', onSettings);
    const t = setInterval(() => void run(), SWEEP_MS);
    return () => {
      window.removeEventListener('hv-post-mode-changed', onSettings);
      window.removeEventListener('storage', onSettings);
      clearInterval(t);
    };
  }, [run]);

  return null;
}
