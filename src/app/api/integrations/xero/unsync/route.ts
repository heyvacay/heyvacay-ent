import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/integrations/tokenStore.server';
import { deleteSpend } from '@/lib/integrations/xero.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Remove a batch of expenses from Xero — used when an expense that was already
 * posted gets rejected. Each is looked up by its HeyVacay Reference and marked
 * DELETED. Idempotent per expense.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const ids: string[] = Array.isArray(body.expenseIds)
    ? (body.expenseIds as unknown[]).map((x) => String(x)).filter(Boolean)
    : [];
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }
  if (!ids.length) {
    return NextResponse.json({ error: 'No expenses to remove.' }, { status: 400 });
  }

  const conn = await getConnection(companyId, 'xero');
  if (!conn || conn.status === 'revoked') {
    return NextResponse.json(
      { error: 'Xero is not connected for this company.' },
      { status: 409 }
    );
  }

  const results: Array<{
    id: string;
    ok: boolean;
    removed?: boolean;
    notFound?: boolean;
    error?: string;
  }> = [];

  for (const id of ids) {
    try {
      const r = await deleteSpend(companyId, id);
      results.push({ id, ok: true, removed: r.removed, notFound: r.notFound });
    } catch (err) {
      results.push({ id, ok: false, error: (err as Error).message.slice(0, 200) });
    }
  }

  const removed = results.filter((r) => r.ok).length;
  return NextResponse.json({ removed, failed: results.length - removed, results });
}
