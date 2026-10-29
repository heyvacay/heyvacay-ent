/**
 * Event cost planning — gives the planner a live-style estimate of what an
 * event will cost in hotels + flights for a given allow-list (room tier) and
 * headcount, flags when it's over budget, and (in smart-planning mode) picks a
 * room tier / nightly target that fits the budget.
 *
 * Nightly rates are indicative market rates by tier; when the live rates API is
 * connected these are replaced by the real city rates for the event dates with
 * the same shape.
 */

import { ROOM_TIERS, roomTierRank, type RoomTier } from './events';

/** Indicative nightly rate (USD) by room tier. */
export const TIER_NIGHTLY: Record<RoomTier, number> = {
  Standard: 185,
  Superior: 260,
  Deluxe: 360,
  Suite: 620,
  Presidential: 1400,
};

/** Indicative round-trip flight cost per traveler (USD). */
export const FLIGHT_PER_PERSON = 420;

export interface EventEstimateInput {
  /** People who will need a hotel (home > 50mi, or unknown). */
  hotelHeadcount: number;
  /** People flying in. */
  flightHeadcount: number;
  nights: number;
  /** The baseline room tier travelers may book. */
  tier: RoomTier;
}

export interface EventEstimate {
  hotel: number;
  flights: number;
  total: number;
  nightly: number;
  perPerson: number;
}

export function estimateEventSpend(i: EventEstimateInput): EventEstimate {
  const nightly = TIER_NIGHTLY[i.tier];
  const hotel = Math.round(nightly * Math.max(0, i.nights) * Math.max(0, i.hotelHeadcount));
  const flights = Math.round(FLIGHT_PER_PERSON * Math.max(0, i.flightHeadcount));
  const total = hotel + flights;
  const heads = Math.max(1, Math.max(i.hotelHeadcount, i.flightHeadcount));
  return { hotel, flights, total, nightly, perPerson: Math.round(total / heads) };
}

export interface BudgetGuidance {
  over: boolean;
  delta: number; // total - budget (positive = over)
  /** Concrete suggestions to bring spend down. */
  suggestions: string[];
}

export function budgetGuidance(
  est: EventEstimate,
  input: EventEstimateInput,
  budget: number
): BudgetGuidance {
  const delta = est.total - budget;
  const over = delta > 0;
  const suggestions: string[] = [];
  if (over) {
    // Try a lower tier.
    const rank = roomTierRank(input.tier);
    if (rank > 0) {
      const lower = ROOM_TIERS[rank - 1];
      const lowerEst = estimateEventSpend({ ...input, tier: lower });
      suggestions.push(
        `Drop the base room tier to ${lower} — saves about ${usd(est.total - lowerEst.total)}.`
      );
    }
    // Trim a night.
    if (input.nights > 1) {
      const perNight = est.nightly * input.hotelHeadcount;
      suggestions.push(`Shorten the stay by one night — saves about ${usd(perNight)}.`);
    }
    // Cap nightly.
    const targetNightly = targetNightlyForBudget(input, budget);
    if (targetNightly > 0 && targetNightly < est.nightly) {
      suggestions.push(
        `Cap hotels at ~${usd(targetNightly)}/night to stay within budget (currently ${usd(est.nightly)}).`
      );
    }
    if (input.flightHeadcount > 0) {
      suggestions.push('Encourage advance / flexible-date flights to shave ~15% off airfare.');
    }
  }
  return { over, delta, suggestions };
}

/** Nightly rate that would keep hotel spend within the (flight-adjusted) budget. */
export function targetNightlyForBudget(i: EventEstimateInput, budget: number): number {
  const flightCost = FLIGHT_PER_PERSON * Math.max(0, i.flightHeadcount);
  const hotelBudget = Math.max(0, budget - flightCost);
  const denom = Math.max(1, i.nights) * Math.max(1, i.hotelHeadcount);
  return Math.floor(hotelBudget / denom);
}

export interface SmartPick {
  tier: RoomTier;
  nightly: number;
  est: EventEstimate;
  /** True if even the cheapest tier is over budget. */
  stillOver: boolean;
}

/** Pick the best (highest) room tier whose total fits the budget. */
export function smartPick(input: EventEstimateInput, budget: number): SmartPick {
  // Walk tiers high → low, choose the first that fits.
  for (let r = ROOM_TIERS.length - 1; r >= 0; r--) {
    const tier = ROOM_TIERS[r];
    const est = estimateEventSpend({ ...input, tier });
    if (est.total <= budget) return { tier, nightly: est.nightly, est, stillOver: false };
  }
  const tier = ROOM_TIERS[0];
  const est = estimateEventSpend({ ...input, tier });
  return { tier, nightly: est.nightly, est, stillOver: true };
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Classify a free-text room name into a tier (best-effort). */
export function classifyRoomTier(roomType: string | undefined): RoomTier {
  const t = (roomType ?? '').toLowerCase();
  if (/presidential|penthouse/.test(t)) return 'Presidential';
  if (/suite|junior suite/.test(t)) return 'Suite';
  if (/deluxe|premier|executive|club/.test(t)) return 'Deluxe';
  if (/superior|premium|upgraded/.test(t)) return 'Superior';
  return 'Standard';
}
