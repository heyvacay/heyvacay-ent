import type { Expense, ExpenseCategory, Policy, PolicyType } from '@/lib/types';

/**
 * Evaluate a submitted expense against the company's expense policies so an
 * approver can see, per line, whether it's in or out of policy.
 */

export interface ExpensePolicyResult {
  status: 'in' | 'warn' | 'out';
  notes: string[];
}

/** Which expense-cap policy types apply to each expense category. */
const CATEGORY_CAPS: Record<ExpenseCategory, PolicyType[]> = {
  Meals: ['max_meal_daily', 'max_dinner', 'max_client_meal'],
  'Ground transport': ['max_ground_transport', 'max_car_daily'],
  Lodging: [],
  Airfare: [],
  Supplies: ['max_expense_other'],
  Other: ['max_expense_other'],
};

const TYPE_LABEL: Partial<Record<PolicyType, string>> = {
  max_meal_daily: 'Meals',
  max_dinner: 'Dinner',
  max_client_meal: 'Client meal',
  max_car_daily: 'Car rental',
  max_ground_transport: 'Ground transport',
  max_expense_other: 'Expense',
};

const rank = { in: 0, warn: 1, out: 2 } as const;

export function evaluateExpense(e: Expense, policies: Policy[]): ExpensePolicyResult {
  const active = policies.filter((p) => p.enabled);
  const notes: string[] = [];
  let status: ExpensePolicyResult['status'] = 'in';
  const bump = (s: ExpensePolicyResult['status']) => {
    if (rank[s] > rank[status]) status = s;
  };

  // Receipt-required-over-$X.
  const rr = active.find((p) => p.type === 'receipt_required_over');
  if (rr && e.amount > Number(rr.value) && !e.hasReceipt) {
    notes.push(`Receipt required over $${rr.value}`);
    bump(rr.action === 'block' ? 'out' : 'warn');
  }

  // Per-category dollar caps — use the tightest matching cap.
  const caps = CATEGORY_CAPS[e.category] || [];
  for (const type of caps) {
    const p = active.find((x) => x.type === type);
    if (p && e.amount > Number(p.value)) {
      notes.push(`${TYPE_LABEL[type] || 'Expense'} over $${p.value} cap`);
      bump(p.action === 'block' ? 'out' : 'warn');
    }
  }

  return { status, notes };
}

/** True when any expense policy is configured (so UI can show the in/out column). */
export function hasExpensePolicies(policies: Policy[]): boolean {
  return policies.some(
    (p) =>
      p.enabled &&
      [
        'max_meal_daily',
        'max_dinner',
        'max_client_meal',
        'max_car_daily',
        'max_ground_transport',
        'max_expense_other',
        'receipt_required_over',
      ].includes(p.type)
  );
}
