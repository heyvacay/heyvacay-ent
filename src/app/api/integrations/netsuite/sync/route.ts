import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/integrations/tokenStore.server';
import { postJournalEntry } from '@/lib/integrations/netsuite.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExpenseIn {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  note?: string;
}

/** Post approved expenses to NetSuite as Journal Entries. */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const expenses: ExpenseIn[] = Array.isArray(body.expenses) ? (body.expenses as ExpenseIn[]) : [];
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  if (!expenses.length) return NextResponse.json({ error: 'No expenses to sync.' }, { status: 400 });

  const conn = await getConnection(companyId, 'netsuite');
  if (!conn || conn.status !== 'connected') return NextResponse.json({ error: 'NetSuite is not connected.' }, { status: 409 });
  const accountMap = conn.accountMap || {};
  if (!conn.paymentAccountId) {
    return NextResponse.json({ error: 'No payment account selected — finish the NetSuite mapping first.' }, { status: 409 });
  }

  const results: Array<{ id: string; ok: boolean; extId?: string; error?: string; verified?: boolean }> = [];
  for (const e of expenses) {
    const expenseAccountId = accountMap[e.category];
    if (!expenseAccountId) {
      results.push({ id: e.id, ok: false, error: `No NetSuite account mapped for "${e.category}".` });
      continue;
    }
    try {
      const r = await postJournalEntry(companyId, {
        expenseId: e.id,
        expenseAccountId,
        paymentAccountId: conn.paymentAccountId,
        amount: Number(e.amount) || 0,
        txnDate: e.date,
        merchant: e.merchant || 'Expense',
        description: e.note,
      });
      if (r.ok) results.push({ id: e.id, ok: true, extId: r.id, verified: true });
      else results.push({ id: e.id, ok: false, error: r.error });
    } catch (err) {
      results.push({ id: e.id, ok: false, error: (err as Error).message.slice(0, 200) });
    }
  }
  const posted = results.filter((r) => r.ok).length;
  return NextResponse.json({ posted, failed: results.length - posted, results });
}
