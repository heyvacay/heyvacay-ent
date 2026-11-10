/**
 * Smart QuickBooks account recommendations for the expense-category mapping.
 *
 * These are SUGGESTIONS only — the UI makes that explicit and asks the user to
 * review each one. We score every QuickBooks account against a per-category
 * knowledge base of QuickBooks AccountSubType values (the strongest signal,
 * since it's a controlled vocabulary) plus name keywords, and recommend the
 * best match only when we're reasonably confident. Weak matches are left blank
 * on purpose — a wrong guess is worse than no guess.
 */

export interface AcctOpt {
  id: string;
  name: string;
  type: string;
  subType?: string;
}

export interface MappingSuggestion {
  /** category -> recommended account id */
  accountMap: Record<string, string>;
  /** recommended payment (bank/card) account id, if confident */
  paymentAccountId?: string;
  /** category -> short human reason (why we picked it), for display */
  reasons: Record<string, string>;
  /** category -> 'high' | 'medium' (only confident-enough picks are returned) */
  confidence: Record<string, 'high' | 'medium'>;
}

interface CategoryRule {
  /** QuickBooks AccountSubType values that strongly indicate this category. */
  subtypes: string[];
  /** Name keywords; the first few are the strongest (primary) terms. */
  keywords: string[];
  /** When true, a generic "Travel" account is an acceptable fallback. */
  travelFallback?: boolean;
}

// Keyed by the exact category labels used in the mapping UI.
const RULES: Record<string, CategoryRule> = {
  Meals: {
    subtypes: ['EntertainmentMeals', 'TravelMeals', 'Meals', 'MealsAndEntertainment'],
    keywords: ['meal', 'dining', 'restaurant', 'food', 'entertainment', 'catering'],
  },
  'Ground transport': {
    subtypes: ['Auto', 'Vehicle', 'Automobile'],
    keywords: [
      'ground transport',
      'transport',
      'taxi',
      'uber',
      'lyft',
      'rideshare',
      'mileage',
      'parking',
      'transit',
      'auto',
      'car',
      'vehicle',
      'fuel',
      'gas',
    ],
    travelFallback: true,
  },
  Lodging: {
    subtypes: ['Travel'],
    keywords: ['lodging', 'hotel', 'accommodation', 'motel', 'stay'],
    travelFallback: true,
  },
  Airfare: {
    subtypes: ['Travel'],
    keywords: ['airfare', 'airline', 'flight', 'air travel', 'air'],
    travelFallback: true,
  },
  Supplies: {
    subtypes: ['SuppliesMaterials', 'Supplies', 'OfficeGeneralAdministrativeExpenses'],
    keywords: ['supplies', 'materials', 'office', 'stationery', 'printing', 'equipment'],
  },
  Other: {
    subtypes: ['OfficeGeneralAdministrativeExpenses', 'OtherMiscellaneousExpense', 'OtherMiscellaneousServiceCost'],
    keywords: ['office expense', 'miscellaneous', 'uncategorized', 'general', 'other', 'purchases'],
  },
};

const norm = (s: string) => (s || '').toLowerCase().trim();

interface Scored {
  acct: AcctOpt;
  score: number;
  reason: string;
}

function scoreAccount(acct: AcctOpt, rule: CategoryRule): Scored {
  const name = norm(acct.name);
  const sub = acct.subType || '';
  let score = 0;
  const why: string[] = [];

  // Subtype is the controlled-vocabulary signal — weight it highest.
  if (sub && rule.subtypes.some((s) => s.toLowerCase() === sub.toLowerCase())) {
    score += 4;
    why.push(`type “${acct.subType}”`);
  }

  // Name keywords: earlier keywords are primary (worth a touch more).
  let matchedKeyword = '';
  rule.keywords.forEach((kw, i) => {
    if (name.includes(kw)) {
      score += i < 2 ? 4 : 3;
      if (!matchedKeyword) matchedKeyword = kw;
    }
  });
  if (matchedKeyword) why.push(`name matches “${matchedKeyword}”`);

  // Travel fallback for travel-ish categories with no direct match.
  if (rule.travelFallback && score === 0) {
    if (sub.toLowerCase() === 'travel' || name.includes('travel')) {
      score += 2;
      why.push('a general Travel account');
    }
  }

  return { acct, score, reason: why.join(', ') };
}

/**
 * Recommend a QuickBooks account per expense category + a payment account.
 * Only returns a suggestion when the best match clears a confidence threshold.
 */
export function recommendMappings(
  expense: AcctOpt[],
  payment: AcctOpt[]
): MappingSuggestion {
  const accountMap: Record<string, string> = {};
  const reasons: Record<string, string> = {};
  const confidence: Record<string, 'high' | 'medium'> = {};

  for (const [category, rule] of Object.entries(RULES)) {
    const ranked = expense
      .map((a) => scoreAccount(a, rule))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.acct.name.length - b.acct.name.length);

    const best = ranked[0];
    if (!best) continue; // leave blank — no confident match

    // Guard against a near-tie producing an arbitrary pick for weak matches.
    const runnerUp = ranked[1];
    const ambiguous = runnerUp && runnerUp.score === best.score;
    if (best.score < 2) continue;
    if (best.score < 3 && ambiguous) continue;

    accountMap[category] = best.acct.id;
    reasons[category] = `${best.acct.name} — ${best.reason || 'closest match'}`;
    confidence[category] = best.score >= 4 ? 'high' : 'medium';
  }

  // Payment account: prefer a credit card (corporate-card is the common case),
  // favoring one whose name looks like a card; else the first bank account.
  const cards = payment.filter((p) => norm(p.type) === 'credit card');
  const banks = payment.filter((p) => norm(p.type) === 'bank');
  const cardByName = cards.find((p) => /card|visa|master|amex|credit/i.test(p.name));
  const paymentAccountId = (cardByName || cards[0] || banks[0])?.id;

  return { accountMap, paymentAccountId, reasons, confidence };
}
