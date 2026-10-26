/**
 * Rewards model — the single source of truth for savings + points.
 *
 * Shared by the booking screen (what we promise before you book) and the store
 * (what actually posts to the ledger), so the number you see on a card is the
 * number you earn. Keep them calling this; don't recompute points inline.
 *
 * Two components, deliberately separate:
 *  - savings  = marketPrice − price. Real for hotels (we have competitor /
 *               reference pricing from the same backend the consumer site
 *               uses). Flights carry no market reference, so their savings is
 *               0 and nothing is fabricated.
 *  - points   = 1 pt per $1 saved vs market, PLUS a flat loyalty earn on spend
 *               (SPEND_POINTS_RATE). The spend earn is a program rate, not a
 *               market claim, so flights still reward the traveler honestly.
 */

/**
 * Points reward SAVINGS, not spend. The more a traveler saves the company
 * versus the market/competitor price, the more they earn — so the incentive
 * is to pick the cheapest in-policy option, never to spend more.
 */
export const SAVINGS_POINTS_MULTIPLIER = 2;

export interface RewardInput {
  type: 'hotel' | 'flight';
  marketPrice: number;
  price: number;
}

export function savingsFor(opt: RewardInput): number {
  return Math.max(0, Math.round(opt.marketPrice - opt.price));
}

export function pointsFor(opt: RewardInput): number {
  // Pure savings-based: 2 points per $1 saved vs market. No spend component.
  return savingsFor(opt) * SAVINGS_POINTS_MULTIPLIER;
}

export function rewardsFor(opt: RewardInput): { savings: number; points: number } {
  return { savings: savingsFor(opt), points: pointsFor(opt) };
}
