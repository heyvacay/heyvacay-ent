import { NextResponse } from 'next/server';
import {
  loadCollection,
  saveCollection,
  loadRecord,
  saveRecord,
} from '@/lib/workspaceStore.server';
import type { Rep, SalesCompany } from '@/lib/crm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Shared CRM / Nova sales book — one tenant-wide partition ("crm") so every rep
 * and device sees the same accounts, reps and commission settings. The signed-in
 * rep identity stays per-device (localStorage), not here.
 *   sk layout: salescompany#<id>, rep#<name>, settings#root (commission + approvals)
 */
const CRM_PK = 'crm';

interface CrmSettings {
  commission?: unknown;
  commissionApprovals?: unknown[];
}

export async function GET() {
  try {
    const [companies, reps, settings] = await Promise.all([
      loadCollection<SalesCompany>(CRM_PK, 'salescompany'),
      loadCollection<Rep>(CRM_PK, 'rep'),
      loadRecord<CrmSettings>(CRM_PK, 'settings'),
    ]);
    // null settings + empty collections = nothing stored yet.
    const empty = companies.length === 0 && reps.length === 0 && !settings;
    return NextResponse.json({
      data: empty
        ? null
        : {
            companies,
            reps,
            commission: settings?.commission ?? null,
            commissionApprovals: settings?.commissionApprovals ?? [],
          },
    });
  } catch {
    return NextResponse.json({ data: null });
  }
}

export async function POST(req: Request) {
  let body: {
    companies?: SalesCompany[];
    reps?: Rep[];
    commission?: unknown;
    commissionApprovals?: unknown[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  try {
    await Promise.all([
      Array.isArray(body.companies)
        ? saveCollection<SalesCompany>(CRM_PK, 'salescompany', body.companies)
        : Promise.resolve(),
      Array.isArray(body.reps)
        ? saveCollection<Rep>(CRM_PK, 'rep', body.reps, (r) => r.name)
        : Promise.resolve(),
      saveRecord(CRM_PK, 'settings', {
        commission: body.commission ?? null,
        commissionApprovals: body.commissionApprovals ?? [],
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message || 'Save failed.' }, { status: 500 });
  }
}
