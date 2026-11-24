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

/* ============================================================================
 * RIDESHARE BOOKING — ride classes, per-class policy, and the normalized option
 * shape the UI/API share. Built for Uber for Business (Guest Rides API) and Lyft
 * Business (Concierge API). rideshare.ts stays import-free (types.ts imports it),
 * so the policy action union is defined locally rather than imported.
 * ==========================================================================*/

export type RideProvider = 'uber' | 'lyft';
export const RIDE_PROVIDERS: RideProvider[] = ['uber', 'lyft'];
export const RIDE_PROVIDER_LABEL: Record<RideProvider, string> = { uber: 'Uber', lyft: 'Lyft' };

/** Four policy tiers that every provider ride class maps onto. */
export type RideTier = 'standard' | 'xl' | 'premium' | 'luxury';
export const RIDE_TIERS: RideTier[] = ['standard', 'xl', 'premium', 'luxury'];
export const RIDE_TIER_LABEL: Record<RideTier, string> = {
  standard: 'Standard',
  xl: 'XL / group',
  premium: 'Premium',
  luxury: 'Luxury',
};
export const RIDE_TIER_SUB: Record<RideTier, string> = {
  standard: 'UberX, Uber Green, Lyft — everyday rides',
  xl: 'UberXL, Lyft XL — 5–6 seats',
  premium: 'Uber Comfort, Lyft Extra Comfort — newer cars, more legroom',
  luxury: 'Uber Black / Black SUV, Lyft Lux / Lux SUV — premium vehicles',
};

/** The action applied to a ride class by policy. */
export type RidePolicyAction = 'allow' | 'approve' | 'block';

export interface RideClass {
  /** Provider product key (Uber product_id family / Lyft ride_type). For Uber the
   *  real product_id is resolved per-city from the estimates API; this is the
   *  stable family key we map policy + display on. */
  key: string;
  provider: RideProvider;
  label: string;
  tier: RideTier;
  seats: number;
}

/** The catalog of ride classes we surface, by provider. Lyft ride_type values are
 *  the literal API values; Uber keys are the product families (resolved to a live
 *  product_id at estimate time). */
export const RIDE_CATALOG: Record<RideProvider, RideClass[]> = {
  uber: [
    { key: 'uberx', provider: 'uber', label: 'UberX', tier: 'standard', seats: 4 },
    { key: 'uber_green', provider: 'uber', label: 'Uber Green', tier: 'standard', seats: 4 },
    { key: 'uber_comfort', provider: 'uber', label: 'Uber Comfort', tier: 'premium', seats: 4 },
    { key: 'uberxl', provider: 'uber', label: 'UberXL', tier: 'xl', seats: 6 },
    { key: 'uber_black', provider: 'uber', label: 'Uber Black', tier: 'luxury', seats: 4 },
    { key: 'uber_black_suv', provider: 'uber', label: 'Uber Black SUV', tier: 'luxury', seats: 6 },
  ],
  lyft: [
    { key: 'lyft', provider: 'lyft', label: 'Lyft', tier: 'standard', seats: 4 },
    { key: 'lyft_xl', provider: 'lyft', label: 'Lyft XL', tier: 'xl', seats: 6 },
    { key: 'lyft_preferred', provider: 'lyft', label: 'Extra Comfort', tier: 'premium', seats: 4 },
    { key: 'lyft_lux', provider: 'lyft', label: 'Lyft Lux', tier: 'luxury', seats: 4 },
    { key: 'lyft_luxsuv', provider: 'lyft', label: 'Lux SUV', tier: 'luxury', seats: 6 },
  ],
};

export function rideClassesFor(provider: RideProvider): RideClass[] {
  return RIDE_CATALOG[provider];
}
export function findRideClass(provider: RideProvider, key: string): RideClass | undefined {
  return RIDE_CATALOG[provider].find((c) => c.key === key);
}

/** Company/event rideshare policy: per-tier action + an optional max fare cap. */
export interface RidePolicy {
  /** Action per tier. Missing tier = 'allow'. */
  tierActions?: Partial<Record<RideTier, RidePolicyAction>>;
  /** Hard cap per ride (USD). A ride estimated above this needs approval. */
  maxFare?: number;
  /** Which provider(s) are allowed. Empty/undefined = both. */
  providers?: RideProvider[];
}

/** Sensible default: everyday + group rides book freely, premium needs approval,
 *  luxury is blocked. Admins can relax or tighten any tier. */
export const DEFAULT_RIDE_POLICY: RidePolicy = {
  tierActions: { standard: 'allow', xl: 'allow', premium: 'approve', luxury: 'block' },
  maxFare: 150,
};

/** Resolve the effective action for a specific ride (tier + estimated fare). */
export function evaluateRidePolicy(
  policy: RidePolicy | undefined,
  tier: RideTier,
  fareEstimate?: number,
  provider?: RideProvider
): { action: RidePolicyAction; reason?: string } {
  const p = policy ?? DEFAULT_RIDE_POLICY;
  if (provider && p.providers && p.providers.length && !p.providers.includes(provider)) {
    return { action: 'block', reason: `${RIDE_PROVIDER_LABEL[provider]} is not enabled by your company.` };
  }
  const tierAction = p.tierActions?.[tier] ?? 'allow';
  if (tierAction === 'block') return { action: 'block', reason: `${RIDE_TIER_LABEL[tier]} rides are not allowed.` };
  if (p.maxFare != null && fareEstimate != null && fareEstimate > p.maxFare) {
    return { action: 'approve', reason: `Over the $${p.maxFare} per-ride cap — needs approval.` };
  }
  return { action: tierAction };
}

/** Normalized ride option returned by the estimate API and rendered by the UI. */
export interface RideOption {
  provider: RideProvider;
  /** Provider product key / ride_type (our catalog key). */
  classKey: string;
  label: string;
  tier: RideTier;
  seats: number;
  etaMinutes?: number;
  fareLow?: number;
  fareHigh?: number;
  currency: string;
  /** Uber upfront-fare id (passed back into the booking call), when present. */
  fareId?: string;
  /** Live provider product_id resolved at estimate time (Uber), when present. */
  productId?: string;
  /** Whether this came from a live provider call vs. the estimate model. */
  live: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
  label?: string;
}

/** Simple, documented straight-line estimate used for the fare model fallback and
 *  the savings calc when no live provider fare is available. Haversine miles. */
export function milesApart(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Per-tier fare multiplier over the base UberX/Lyft estimate, for the model. */
export const RIDE_TIER_MULTIPLIER: Record<RideTier, number> = {
  standard: 1,
  xl: 1.6,
  premium: 1.35,
  luxury: 2.4,
};

/** Model fare (USD) for a tier over a distance, when no live fare is available.
 *  Base ≈ $2.5 base + $1.75/mi + $0.35/min (assume ~2.5 min/mi city). */
export function modelFare(tier: RideTier, miles: number): number {
  const base = 2.5 + 1.75 * miles + 0.35 * (miles * 2.5);
  const withSurge = Math.max(8, base) * RIDE_TIER_MULTIPLIER[tier];
  return Math.round(withSurge);
}
