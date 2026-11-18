/**
 * Ground-transport savings model: rideshare (Uber/Lyft) vs. rental car.
 *
 * WHY A MODEL AND NOT A LIVE API
 * ------------------------------
 * Neither Uber nor Lyft offers a public, self-serve fare-estimate API anymore:
 *  - Uber's estimate endpoints (e.g. POST /v2/employees/trips/estimates) are
 *    gated behind an **Uber for Business Enterprise** agreement — you need a
 *    signed contract and issued OAuth credentials before the endpoint answers.
 *  - Lyft deprecated its public developer API; the old developer.lyft.com is
 *    gone and the official SDKs were archived in 2026. Fare access now requires
 *    a Lyft Business relationship.
 * So out of the box we estimate with a transparent, tunable cost model built
 * from typical US business-travel costs. Every assumption is a named constant
 * here, and `compareGround` returns the breakdown so the UI can show its work.
 *
 * UPGRADE PATH: once the customer has an Uber for Business contract, drop their
 * fare estimates into `estimateRideshareCost` (replace the model number with the
 * live upfront fare) — the comparison and policy plumbing stay the same.
 */

export type GroundMode = 'any' | 'rideshare' | 'rental';

export const GROUND_MODE_LABELS: Record<GroundMode, string> = {
  any: 'Traveler decides',
  rideshare: 'Rideshare only',
  rental: 'Rental car only',
};

export const GROUND_MODE_SUB: Record<GroundMode, string> = {
  any: 'Show the savings estimate and let the traveler pick the cheaper option',
  rideshare: 'Uber / Lyft only — no rental car on this trip',
  rental: 'Rental car only — no rideshare reimbursement',
};

/**
 * US business-travel cost assumptions (all USD). These are deliberately
 * conservative averages; tune per customer as real spend data comes in.
 */
export const GROUND_ASSUMPTIONS = {
  /** Rental car daily base rate (midsize, corporate rate). */
  rentalDailyBase: 72,
  /** Loss-damage waiver / insurance per day (most policies require it). */
  rentalInsuranceDaily: 22,
  /** Fuel per rental day (refuel + the convenience of driving everywhere). */
  rentalFuelDaily: 16,
  /** Parking per day: hotel overnight + venue daytime (major metro). */
  rentalParkingDaily: 28,
  /** One-way airport <-> hotel rideshare (metro average, incl. surge cushion). */
  rideshareAirportLeg: 46,
  /** Average cost of one local rideshare hop (meeting, dinner, etc.). */
  rideshareLocalRide: 18,
  /** Default local rideshare hops per day for a typical business trip. */
  defaultRidesPerDay: 2,
} as const;

export interface GroundInput {
  /** Number of days on the ground (min 1). */
  days: number;
  /** Local rideshare hops per day (excludes the airport transfer). */
  ridesPerDay?: number;
  /** Whether the trip actually needs paid parking (downtown vs. suburban). */
  parking?: boolean;
}

export interface GroundEstimate {
  mode: 'rideshare' | 'rental';
  total: number;
  /** Human-readable line items, each a [label, amount] pair. */
  lines: { label: string; amount: number }[];
}

export interface GroundComparison {
  rideshare: GroundEstimate;
  rental: GroundEstimate;
  /** Which option is cheaper for this trip. */
  cheaper: 'rideshare' | 'rental';
  /** Absolute dollars saved by choosing the cheaper option. */
  savings: number;
  /** Savings as a share of the pricier option (0–1). */
  savingsPct: number;
  /** One-line plain-English takeaway. */
  rationale: string;
}

const clampDays = (d: number) => Math.max(1, Math.round(d || 1));

/** Estimated rideshare cost for the trip (round-trip airport + daily hops). */
export function estimateRideshareCost(input: GroundInput): GroundEstimate {
  const a = GROUND_ASSUMPTIONS;
  const days = clampDays(input.days);
  const ridesPerDay = input.ridesPerDay ?? a.defaultRidesPerDay;
  const airport = a.rideshareAirportLeg * 2; // to the hotel and back
  const local = a.rideshareLocalRide * ridesPerDay * days;
  const lines = [
    { label: 'Airport transfer (round trip)', amount: airport },
    {
      label: `Local rides (${ridesPerDay}/day × ${days} ${days === 1 ? 'day' : 'days'})`,
      amount: local,
    },
  ];
  return { mode: 'rideshare', total: Math.round(airport + local), lines };
}

/** Estimated rental-car cost for the trip (base + insurance + fuel + parking). */
export function estimateRentalCost(input: GroundInput): GroundEstimate {
  const a = GROUND_ASSUMPTIONS;
  const days = clampDays(input.days);
  const parking = input.parking ?? true;
  const base = a.rentalDailyBase * days;
  const insurance = a.rentalInsuranceDaily * days;
  const fuel = a.rentalFuelDaily * days;
  const park = parking ? a.rentalParkingDaily * days : 0;
  const lines = [
    { label: `Daily rate (${days} ${days === 1 ? 'day' : 'days'})`, amount: base },
    { label: 'Insurance / LDW', amount: insurance },
    { label: 'Fuel', amount: fuel },
  ];
  if (park) lines.push({ label: 'Parking (hotel + venue)', amount: park });
  return { mode: 'rental', total: Math.round(base + insurance + fuel + park), lines };
}

/** Compare both ground-transport options for a trip and pick the cheaper one. */
export function compareGround(input: GroundInput): GroundComparison {
  const rideshare = estimateRideshareCost(input);
  const rental = estimateRentalCost(input);
  const cheaper = rideshare.total <= rental.total ? 'rideshare' : 'rental';
  const hi = Math.max(rideshare.total, rental.total);
  const lo = Math.min(rideshare.total, rental.total);
  const savings = hi - lo;
  const savingsPct = hi > 0 ? savings / hi : 0;
  const days = clampDays(input.days);
  const rationale =
    savings === 0
      ? 'Rideshare and a rental car cost about the same for this trip.'
      : cheaper === 'rideshare'
        ? `Rideshare saves about $${savings.toLocaleString()} (${Math.round(
            savingsPct * 100
          )}%) over a rental car for a ${days}-day trip with light local driving.`
        : `A rental car saves about $${savings.toLocaleString()} (${Math.round(
            savingsPct * 100
          )}%) — the heavy local driving on this trip outweighs rideshare per-ride costs.`;
  return { rideshare, rental, cheaper, savings, savingsPct, rationale };
}

/** Days between two ISO dates (inclusive of travel day), min 1. */
export function tripDays(startISO?: string, endISO?: string): number {
  if (!startISO || !endISO) return 1;
  const ms = Date.parse(endISO) - Date.parse(startISO);
  if (!Number.isFinite(ms)) return 1;
  return clampDays(ms / 86_400_000 + 1);
}
