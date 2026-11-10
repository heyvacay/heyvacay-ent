import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/integrations/tokenStore.server';
import { createPurchase } from '@/lib/integrations/quickbooks.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExpenseIn {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  paidWith?: 'company' | 'personal';
}

/**
 * Post a batch of approved expenses to QuickBooks as Purchases. Each expense is
 * routed to the GL account mapped for its category; the purchase is paid from
 * the mapped payment account. Returns a per-expense result so the client can
 * mark the ones that posted and show which (if any) failed.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const expenses: ExpenseIn[] = Array.isArray(body.expenses)
    ? (body.expenses as ExpenseIn[])
    : [];
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }
  if (!expenses.length) {
    return NextResponse.json({ error: 'No expenses to sync.' }, { status: 400 });
  }

  const conn = await getConnection(companyId, 'quickbooks');
  if (!conn || conn.status === 'revoked') {
    return NextResponse.json(
      { error: 'QuickBooks is not connected for this company.' },
      { status: 409 }
    );
  }
  const accountMap = conn.accountMap || {};
  if (!conn.paymentAccountId) {
    return NextResponse.json(
      { error: 'No payment account selected — finish the QuickBooks account mapping first.' },
      { status: 409 }
    );
  }

  const results: Array<{
    id: string;
    ok: boolean;
    qboId?: string;
    viewUrl?: string;
    error?: string;
  }> = [];

  // Sequential on purpose: QBO rate-limits and a batch here is small (approved,
  // not-yet-synced expenses). Keeps error attribution clean.
  for (const e of expenses) {
    const expenseAccountId = accountMap[e.category];
    if (!expenseAccountId) {
      results.push({
        id: e.id,
        ok: false,
        error: `No QuickBooks account mapped for category "${e.category}".`,
      });
      continue;
    }
    try {
      const r = await createPurchase(companyId, {
        expenseAccountId,
        paymentAccountId: conn.paymentAccountId,
        amount: Number(e.amount) || 0,
        txnDate: e.date,
        merchant: e.merchant || 'Expense',
        description: e.note,
        paymentType: e.paidWith === 'personal' ? 'Cash' : 'CreditCard',
      });
      results.push({ id: e.id, ok: true, qboId: r.id, viewUrl: r.viewUrl });
    } catch (err) {
      results.push({ id: e.id, ok: false, error: (err as Error).message.slice(0, 200) });
    }
  }

  const posted = results.filter((r) => r.ok).length;
  return NextResponse.json({ posted, failed: results.length - posted, results });
}
