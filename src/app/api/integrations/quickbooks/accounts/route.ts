import { NextResponse } from 'next/server';
import { listAccounts } from '@/lib/integrations/quickbooks.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The company's live QuickBooks chart of accounts, split into expense accounts
 * (for category → GL mapping) and payment accounts (bank / credit-card, for the
 * account a purchase is paid from).
 */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }
  try {
    const accounts = await listAccounts(companyId);
    const expense = accounts.filter((a) =>
      ['Expense', 'Cost of Goods Sold', 'Other Expense'].includes(a.AccountType)
    );
    const payment = accounts.filter((a) =>
      ['Bank', 'Credit Card'].includes(a.AccountType)
    );
    return NextResponse.json({
      expense: expense.map((a) => ({ id: a.Id, name: a.Name, type: a.AccountType, subType: a.AccountSubType })),
      payment: payment.map((a) => ({ id: a.Id, name: a.Name, type: a.AccountType })),
      all: accounts.map((a) => ({ id: a.Id, name: a.Name, type: a.AccountType })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
