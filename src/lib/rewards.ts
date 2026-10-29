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
 * Points earn a quarter of a percentage point (0.25%) of trip spend, in points
 * where 1 point = 1¢ — so a $1,000 trip earns ~250 points (~$2.50 back). The
 * company's savings vs market are surfaced separately as its own benefit.
 */
export const POINTS_RATE = 0.0025; // 0.25%
/** Points are denominated in cents, so $1 of earn = 100 points. */
const POINTS_PER_DOLLAR = 100;

export interface RewardInput {
  type: 'hotel' | 'flight';
  marketPrice: number;
  price: number;
}

export function savingsFor(opt: RewardInput): number {
  return Math.max(0, Math.round(opt.marketPrice - opt.price));
}

export function pointsFor(opt: RewardInput): number {
  // 0.25% of spend, in cents → round(price * 0.0025 * 100) = round(price * 0.25).
  return Math.round(Math.max(0, opt.price) * POINTS_RATE * POINTS_PER_DOLLAR);
}

export function rewardsFor(opt: RewardInput): { savings: number; points: number } {
  return { savings: savingsFor(opt), points: pointsFor(opt) };
}
