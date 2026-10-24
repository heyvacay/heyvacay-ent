/**
 * Hotel room matrix — the bed → refundability → meal structure the
 * /hotels/details API returns as `UIRooms`. Ported from the consumer site so
 * the enterprise detail page renders rooms identically. Includes the pricing
 * normalization (snake_case → numbers), the default-selection logic, and the
 * lead-price helper for the sticky book bar.
 */

export interface TaxFee {
  name: string;
  amount: string;
  currency: string;
  included?: boolean;
}

export interface RateRef {
  taxes_fees?: TaxFee[];
  book_hash: string;
  price: number;
  pricePerDay?: number;
  competitivePrice?: number;
  currency: string;
  freeCancellationBefore?: string | null;
}

export interface MealOption {
  mealCode: string;
  label: string;
  isDisabled: boolean;
  rateRef: RateRef | null;
  priceDelta?: number | null;
  isDefault?: boolean;
}

export interface RefundOption {
  refundKey: string;
  label: string;
  isDisabled: boolean;
  cancellation?: { free_until?: string | null };
  mealOptions: MealOption[];
  priceDelta?: number | null;
  isDefault?: boolean;
}

export interface BedOption {
  bedKey: string;
  bedLabel: string;
  isDisabled: boolean;
  refundOptions: RefundOption[];
  priceDelta?: number | null;
  isDefault?: boolean;
}

export interface UiRoom {
  roomKey: string;
  roomTitle: string;
  from: { amount: number; currency: string; competitivePrice?: number };
  images: string[];
  amenities: string[];
  capacity: number;
  bedOptions: BedOption[];
}

export interface RoomSelection {
  bedKey: string;
  refundKey: string;
  mealCode: string;
}

export interface RoomLeaf {
  bed: BedOption;
  refund: RefundOption;
  meal: MealOption;
}

/* ---------------- normalization ---------------- */

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** RateHawk room image URLs carry a {size} token; swap for a usable size. */
function roomImg(u: string, size = '640x400'): string {
  return u.replace('{size}', size).replace('{SIZE}', size);
}

function normRate(raw: Record<string, unknown> | null | undefined): RateRef | null {
  if (!raw) return null;
  const price = num(raw.price);
  if (price == null) return null;
  const book_hash = String(raw.book_hash ?? raw.match_hash ?? '');
  const competitivePrice =
    num(raw.competitivePrice) ?? num((raw as { competitive_price?: unknown }).competitive_price);
  const pricePerDay =
    num(raw.pricePerDay) ?? num((raw as { average_nightly_rate?: unknown }).average_nightly_rate);
  return {
    book_hash,
    price,
    pricePerDay,
    competitivePrice,
    currency: String(raw.currency ?? 'USD'),
    freeCancellationBefore:
      (raw.freeCancellationBefore as string | null | undefined) ?? null,
    taxes_fees: Array.isArray(raw.taxes_fees) ? (raw.taxes_fees as TaxFee[]) : undefined,
  };
}

/** Normalize the raw UIRooms matrix into UiRoom[] (prices as numbers, images flat). */
export function enrichUiRooms(raw: unknown): UiRoom[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): UiRoom | null => {
      if (!r || typeof r !== 'object') return null;
      const room = r as Record<string, unknown>;
      const roomKey = String(room.roomKey ?? room.roomTitle ?? '');
      if (!roomKey) return null;

      const images = (Array.isArray(room.images) ? room.images : [])
        .map((im) => (typeof im === 'string' ? im : (im as { url?: string })?.url))
        .filter((u): u is string => Boolean(u))
        .map((u) => roomImg(u));

      const fromRaw = (room.from ?? {}) as Record<string, unknown>;
      const bedOptions = (Array.isArray(room.bedOptions) ? room.bedOptions : []).map(
        (b): BedOption => {
          const bed = b as Record<string, unknown>;
          return {
            bedKey: String(bed.bedKey ?? ''),
            bedLabel: String(bed.bedLabel ?? bed.bedKey ?? 'Standard'),
            isDisabled: Boolean(bed.isDisabled),
            priceDelta: num(bed.priceDelta) ?? null,
            isDefault: Boolean(bed.isDefault),
            refundOptions: (Array.isArray(bed.refundOptions) ? bed.refundOptions : []).map(
              (rf): RefundOption => {
                const refund = rf as Record<string, unknown>;
                return {
                  refundKey: String(refund.refundKey ?? ''),
                  label: String(refund.label ?? 'Non-refundable'),
                  isDisabled: Boolean(refund.isDisabled),
                  priceDelta: num(refund.priceDelta) ?? null,
                  isDefault: Boolean(refund.isDefault),
                  cancellation: refund.cancellation as
                    | { free_until?: string | null }
                    | undefined,
                  mealOptions: (Array.isArray(refund.mealOptions)
                    ? refund.mealOptions
                    : []
                  ).map((ml): MealOption => {
                    const meal = ml as Record<string, unknown>;
                    return {
                      mealCode: String(meal.mealCode ?? 'nomeal'),
                      label: String(meal.label ?? 'Room only'),
                      isDisabled: Boolean(meal.isDisabled),
                      priceDelta: num(meal.priceDelta) ?? null,
                      isDefault: Boolean(meal.isDefault),
                      rateRef: normRate(meal.rateRef as Record<string, unknown>),
                    };
                  }),
                };
              }
            ),
          };
        }
      );

      return {
        roomKey,
        roomTitle: String(room.roomTitle ?? 'Room'),
        from: {
          amount: num(fromRaw.amount) ?? 0,
          currency: String(fromRaw.currency ?? 'USD'),
          competitivePrice:
            num(fromRaw.competitivePrice) ??
            num((fromRaw as { competitive_price?: unknown }).competitive_price),
        },
        images,
        amenities: Array.isArray(room.amenities)
          ? (room.amenities as string[]).filter((a) => typeof a === 'string')
          : [],
        capacity: num(room.capacity) ?? 2,
        bedOptions,
      };
    })
    .filter((x): x is UiRoom => x !== null && x.bedOptions.length > 0);
}

/* ---------------- selection logic ---------------- */

/** The default bed/refund/meal — honoring isDefault hints, else first enabled. */
export function defaultSelection(room: UiRoom): RoomSelection | null {
  const bed =
    room.bedOptions.find((b) => b.isDefault && !b.isDisabled) ??
    room.bedOptions.find((b) => !b.isDisabled);
  if (!bed) return null;
  const refund =
    bed.refundOptions.find((r) => r.isDefault && !r.isDisabled) ??
    bed.refundOptions.find((r) => !r.isDisabled);
  if (!refund) return null;
  const meal =
    refund.mealOptions.find((m) => m.isDefault && !m.isDisabled && m.rateRef) ??
    refund.mealOptions.find((m) => !m.isDisabled && m.rateRef);
  if (!meal) return null;
  return { bedKey: bed.bedKey, refundKey: refund.refundKey, mealCode: meal.mealCode };
}

/** Resolve the currently-selected bed/refund/meal objects. */
export function resolveLeaf(room: UiRoom, sel: RoomSelection | null): RoomLeaf | null {
  if (!sel) return null;
  const bed =
    room.bedOptions.find((b) => b.bedKey === sel.bedKey) ?? room.bedOptions[0];
  if (!bed) return null;
  const refund =
    bed.refundOptions.find((r) => r.refundKey === sel.refundKey) ?? bed.refundOptions[0];
  if (!refund) return null;
  const meal =
    refund.mealOptions.find((m) => m.mealCode === sel.mealCode) ?? refund.mealOptions[0];
  if (!meal) return null;
  return { bed, refund, meal };
}

export function firstEnabledRefund(bed: BedOption): RefundOption | undefined {
  return bed.refundOptions.find((r) => !r.isDisabled) ?? bed.refundOptions[0];
}
export function firstEnabledMeal(refund: RefundOption): MealOption | undefined {
  return (
    refund.mealOptions.find((m) => !m.isDisabled && m.rateRef) ?? refund.mealOptions[0]
  );
}

/* ---------------- pricing ---------------- */

export function sumPayAtProperty(fees?: TaxFee[]): number {
  if (!Array.isArray(fees)) return 0;
  return fees
    .filter((f) => f.included === false)
    .reduce((s, f) => s + (num(f.amount) ?? 0), 0);
}

export interface LeadPrice {
  price: number;
  pricePerDay: number;
  currency: string;
  payAtProperty: number;
}

/** Cheapest bookable rate across all rooms — drives the sticky book bar. */
export function leadRoomPrice(rooms: UiRoom[]): LeadPrice | null {
  let best: { base: number; rate: RateRef } | null = null;
  for (const room of rooms) {
    for (const bed of room.bedOptions) {
      for (const refund of bed.refundOptions) {
        for (const meal of refund.mealOptions) {
          const rate = meal.rateRef;
          if (!rate) continue;
          if (!best || rate.price < best.base) best = { base: rate.price, rate };
        }
      }
    }
  }
  if (best) {
    const pap = sumPayAtProperty(best.rate.taxes_fees);
    return {
      price: Math.ceil(best.base + pap),
      pricePerDay: Math.ceil(best.rate.pricePerDay ?? best.rate.price),
      currency: best.rate.currency,
      payAtProperty: pap,
    };
  }
  const cheapest = rooms
    .map((r) => r.from.amount)
    .filter((n) => n > 0)
    .sort((a, b) => a - b)[0];
  if (cheapest) {
    return {
      price: Math.ceil(cheapest),
      pricePerDay: Math.ceil(cheapest),
      currency: rooms[0]?.from.currency ?? 'USD',
      payAtProperty: 0,
    };
  }
  return null;
}

export function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}
