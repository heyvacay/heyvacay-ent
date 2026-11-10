import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/integrations/tokenStore.server';
import { createSpend } from '@/lib/integrations/xero.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExpenseIn {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  note?: string;
  paidWith?: 'company' | 'personal';
}

/** Post a batch of approved expenses to Xero as SPEND bank transactions. */
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

  const conn = await getConnection(companyId, 'xero');
  if (!conn || conn.status === 'revoked') {
    return NextResponse.json({ error: 'Xero is not connected for this company.' }, { status: 409 });
  }
  const accountMap = conn.accountMap || {};
  if (!conn.paymentAccountId) {
    return NextResponse.json(
      { error: 'No bank account selected — finish the Xero account mapping first.' },
      { status: 409 }
    );
  }

  const results: Array<{
    id: string;
    ok: boolean;
    viewUrl?: string;
    error?: string;
    verified?: boolean;
    verifyNote?: string;
    duplicate?: boolean;
  }> = [];

  for (const e of expenses) {
    const expenseAccountCode = accountMap[e.category];
    if (!expenseAccountCode) {
      results.push({ id: e.id, ok: false, error: `No Xero account mapped for category "${e.category}".` });
      continue;
    }
    try {
      const r = await createSpend(companyId, {
        expenseId: e.id,
        expenseAccountCode,
        paymentAccountId: conn.paymentAccountId,
        amount: Number(e.amount) || 0,
        txnDate: e.date,
        merchant: e.merchant || 'Expense',
        description: e.note,
      });
      results.push({
        id: e.id,
        ok: true,
        viewUrl: r.viewUrl,
        verified: r.verified,
        verifyNote: r.verifyNote,
        duplicate: r.duplicate,
      });
    } catch (err) {
      results.push({ id: e.id, ok: false, error: (err as Error).message.slice(0, 200) });
    }
  }

  const posted = results.filter((r) => r.ok).length;
  return NextResponse.json({ posted, failed: results.length - posted, results });
}
