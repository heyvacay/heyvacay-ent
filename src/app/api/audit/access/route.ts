import { NextResponse } from 'next/server';
import { appendAccessLog, loadAccessLog, type AccessLogEntry } from '@/lib/workspaceStore.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Internal account-access audit log. Every time a Nova rep enters a customer
 * account, we record who, which account, when, why, and any comment. Append-only
 * and internal — never surfaced to the customer.
 *   GET  /api/audit/access?companyId=... → that company's history (omit for all)
 *   POST /api/audit/access { companyId, companyName, repName, reason, comment }
 */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId') || undefined;
  try {
    const entries = await loadAccessLog(companyId);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}

export async function POST(req: Request) {
  let body: Partial<AccessLogEntry>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '');
  const reason = String(body.reason || '').trim();
  if (!companyId || !reason) {
    return NextResponse.json(
      { error: 'companyId and reason are required.' },
      { status: 400 }
    );
  }
  const entry: AccessLogEntry = {
    id: `al_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    companyId,
    companyName: String(body.companyName || ''),
    repName: String(body.repName || 'Unknown rep'),
    reason,
    comment: body.comment ? String(body.comment) : undefined,
    at: new Date().toISOString(),
  };
  try {
    await appendAccessLog(entry);
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message || 'Log failed.' }, { status: 500 });
  }
}
