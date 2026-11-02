/**
 * Live hotel booking orchestration (client side).
 *
 * Builds the real supplier payloads — exactly the shapes heyvacay.co sends — and
 * drives the booking steps through this app's server proxy routes (which attach
 * the Enterprise service-account auth). The Stripe card confirmation itself lives
 * in the LiveHotelCheckout component, since it needs the Stripe Elements context;
 * everything else (prebook, form, payment-init, confirm, status poll) is here.
 *
 * The whole live path is dormant until live booking is configured on the server
 * (service-account credentials present): the proxy returns 501 and the checkout
 * falls back to recording the trip in the workspace without a supplier order.
 */

import type { ReserveArgs } from '@/components/hotels/RoomCard';
import type { HotelDetailData } from './search';

export interface LiveGuest {
  firstName: string;
  lastName: string;
  email: string;
  note?: string;
}

/* ---------------- payload builders ---------------- */

const str = (v: unknown, fallback = ''): string =>
  v == null ? fallback : String(v);

function pick(obj: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] != null) return obj[k];
  }
  return undefined;
}

/** A UUID v4, from the platform crypto when available. */
function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * The transformed prebook payload, matching the consumer's
 * transformBookingPayload output (idempotencyKey + whitelisted hotel/room).
 */
export function buildPrebookPayload(args: {
  hid: string;
  detail: HotelDetailData;
  rate: ReserveArgs;
  checkin: string;
  checkout: string;
  adults: number;
}): Record<string, unknown> {
  const { hid, detail, rate, checkin, checkout, adults } = args;
  const raw = rate.rateRaw ?? {};
  const rawHotel = detail.rawHotel ?? {};

  const bookHash = rate.bookHash;
  const currency = rate.currency || str(raw.currency, 'USD');

  // Price: the supplier rate price (not the all-in that includes pay-at-property).
  const priceObj = (pick(raw, 'price') as Record<string, unknown>) ?? {};
  const total = str(
    pick(priceObj, 'total', 'amount') ?? pick(raw, 'price'),
    String(rate.price)
  );
  const signature = pick(raw, 'priceSig', 'signature') ?? pick(priceObj, 'signature');
  const cutPrice = pick(priceObj, 'cut_price', 'cutPrice');

  const taxes = Array.isArray(raw.taxes_fees)
    ? (raw.taxes_fees as Record<string, unknown>[]).map((t) => ({
        name: str(t.name),
        amount: str(t.amount),
        currency: str(t.currency, currency),
        included: t.included === false ? false : true,
      }))
    : [];

  const room: Record<string, unknown> = {
    id: bookHash,
    book_hash: bookHash,
    name: rate.roomTitle,
    capacity: rate.roomCapacity ?? 2,
    bedding_type: str(pick(raw, 'bedding_type', 'bed_type')),
    amenities: Array.isArray(rate.roomAmenities) ? rate.roomAmenities : [],
    images: (rate.roomImages ?? []).map((url) => ({ url })),
    price: {
      currency,
      total,
      per_night: [] as string[],
      ...(cutPrice != null ? { cut_price: str(cutPrice) } : {}),
      ...(signature != null ? { signature: str(signature) } : {}),
    },
    taxes_fees: taxes,
    payment_type: str(pick(raw, 'payment_type', 'paymentType')),
    cancellation_policy: pick(raw, 'cancellation_policy', 'cancellationPolicy') ?? {},
    refund_policy: str(pick(raw, 'refund_policy', 'refundPolicy')),
  };

  const region =
    str((pick(rawHotel, 'region') as { name?: string } | undefined)?.name) ||
    detail.address ||
    '';

  const hotel: Record<string, unknown> = {
    id: String(hid),
    hid: Number(hid),
    name: detail.name ?? '',
    region,
    images: detail.images ?? [],
    address: detail.address ?? '',
    starRating: detail.star ?? undefined,
    description: detail.about?.[0],
    latitude: detail.lat,
    longitude: detail.lng,
    amenities: detail.amenities ?? [],
  };

  return {
    idempotencyKey: uuid(),
    hotel,
    room,
    dates: { checkin, checkout },
    guests: [{ adults: Math.max(1, adults), children: [] as number[] }],
  };
}

/* ---------------- step callers (through the server proxy) ---------------- */

async function postJson(
  path: string,
  body: unknown
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export interface PriceChange {
  previousAmount: number;
  newAmount: number;
  difference: number;
  currency: string;
}

export interface PrebookResult {
  bookingRef?: string;
  priceChanged?: boolean;
  priceDropped?: boolean;
  /** Supplier-confirmed price vs what the guest saw (backend amounts). Present
   *  when priceChanged/priceDropped so the UI can show the new total. */
  priceChange?: PriceChange | null;
  errorType?: string | null;
  message?: string;
  raw: Record<string, unknown>;
}

export async function prebook(payload: Record<string, unknown>): Promise<PrebookResult> {
  const { ok, status, data } = await postJson('/api/bookings/prebook', payload);
  if (!ok) {
    const map: Record<number, string> = {
      410: 'no_longer_available',
      409: 'price_changed',
      403: 'booking_disabled',
      504: 'timeout',
      502: 'bad_gateway',
      501: 'live_booking_disabled',
    };
    return {
      errorType: map[status] ?? 'generic',
      message: str(data.message, 'Prebook failed.'),
      raw: data,
    };
  }
  const pc = data.priceChange as PriceChange | null | undefined;
  const changed = data.priceChanged === true || data.priceDropped === true;
  return {
    bookingRef: data.bookingRef as string | undefined,
    priceChanged: changed,
    priceDropped: data.priceDropped === true,
    priceChange:
      pc && typeof pc === 'object'
        ? {
            previousAmount: Number(pc.previousAmount),
            newAmount: Number(pc.newAmount),
            difference: Number(pc.difference),
            currency: String(pc.currency || 'USD'),
          }
        : null,
    // A changed price is no longer a hard error — the UI continues at the new
    // price — so only flag it when we DON'T have a bookingRef to proceed with.
    errorType: changed && !data.bookingRef ? 'price_changed' : null,
    message: data.message as string | undefined,
    raw: data,
  };
}

export interface PaymentType {
  type: string;
  amount: string;
  currency_code: string;
}

export async function bookingForm(
  bookingRef: string
): Promise<{ paymentTypes?: PaymentType[]; errorType?: string | null; raw: Record<string, unknown> }> {
  const { ok, data } = await postJson('/api/bookings/form', { bookingRef });
  if (!ok) return { errorType: 'rate_unavailable', raw: data };
  return {
    paymentTypes: (data.paymentTypes as PaymentType[]) ?? [],
    errorType: null,
    raw: data,
  };
}

/** Pick the payment type the consumer uses: USD "now", else USD "deposit". */
export function choosePaymentType(types: PaymentType[] | undefined): PaymentType | undefined {
  if (!types || types.length === 0) return undefined;
  return (
    types.find((t) => t.currency_code === 'USD' && t.type === 'now') ??
    types.find((t) => t.currency_code === 'USD' && t.type === 'deposit') ??
    types.find((t) => t.currency_code === 'USD') ??
    types[0]
  );
}

export interface PaymentInit {
  clientSecret?: string;
  /** The publishable key for the Stripe account that CREATED this intent (the
   *  backend's). Must be used to confirm — the enterprise app's own key is a
   *  different account, so confirming with it yields "No such payment_intent". */
  publishableKey?: string;
  payUuid?: string;
  initUuid?: string;
  orderId?: string;
  errorType?: string | null;
  raw: Record<string, unknown>;
}

function extractClientSecret(r: Record<string, unknown>): string | undefined {
  const direct = (r.clientSecret ?? r.client_secret) as string | undefined;
  if (typeof direct === 'string') return direct;
  for (const key of ['payment_intent', 'paymentIntent', 'stripe', 'stripePaymentIntent']) {
    const n = r[key];
    if (n && typeof n === 'object') {
      const s = ((n as Record<string, unknown>).client_secret ??
        (n as Record<string, unknown>).clientSecret) as string | undefined;
      if (typeof s === 'string') return s;
    }
  }
  return undefined;
}

export async function paymentInit(args: {
  bookingRef: string;
  amount: number;
  currency: string;
}): Promise<PaymentInit> {
  const { ok, data } = await postJson('/api/bookings/payment', {
    bookingRef: args.bookingRef,
    paymentAmount: String(args.amount),
    currencyCode: args.currency.toLowerCase(),
  });
  if (!ok) return { errorType: 'generic', raw: data };
  return {
    clientSecret: extractClientSecret(data),
    publishableKey:
      (data.publishableKey as string | undefined) ??
      (data.publishable_key as string | undefined),
    payUuid: data.payUuid as string | undefined,
    initUuid: data.initUuid as string | undefined,
    orderId: data.orderId as string | undefined,
    errorType: null,
    raw: data,
  };
}

/** The finish/confirm body — confirm adds paymentIntentId. */
export function buildConfirmPayload(args: {
  bookingRef: string;
  bookHash: string;
  guest: LiveGuest;
  amount: number;
  payUuid?: string;
  initUuid?: string;
  paymentIntentId?: string;
}): Record<string, unknown> {
  const { bookingRef, bookHash, guest, amount, payUuid, initUuid, paymentIntentId } = args;
  return {
    bookingRef,
    bookHash,
    language: 'en',
    customer: {
      email: guest.email,
      ...(guest.note ? { userRequest: guest.note } : {}),
    },
    rooms: [{ guests: [{ first_name: guest.firstName, last_name: guest.lastName }] }],
    paymentType: {
      type: 'deposit',
      amount: String(amount),
      currency_code: 'USD',
      ...(initUuid ? { init_uuid: initUuid } : {}),
      ...(payUuid ? { pay_uuid: payUuid } : {}),
    },
    ...(paymentIntentId ? { paymentIntentId } : {}),
  };
}

export async function confirmBooking(
  payload: Record<string, unknown>
): Promise<{ status?: string; bookingRef?: string; errorType?: string | null; message?: string; raw: Record<string, unknown> }> {
  const { ok, data } = await postJson('/api/bookings/confirm', payload);
  if (!ok)
    return { errorType: 'generic', message: str(data.message, 'Could not finalize the booking.'), raw: data };
  return {
    status: data.status as string | undefined,
    bookingRef: data.bookingRef as string | undefined,
    errorType: null,
    raw: data,
  };
}

const TERMINAL_OK = new Set(['confirmed']);
const TERMINAL_FAIL = new Set(['error', 'failed', 'cancelled']);

export interface PollResult {
  status: string;
  ok: boolean;
  failed: boolean;
}

/** Poll /bookings/{ref}/status until terminal (same backoff as the consumer). */
export async function pollStatus(
  bookingRef: string,
  opts: { maxPolls?: number } = {}
): Promise<PollResult> {
  const maxPolls = opts.maxPolls ?? 25;
  const delays = [2000, 3000, 5000, 8000];
  for (let i = 0; i < maxPolls; i++) {
    const res = await fetch(`/api/bookings/status?ref=${encodeURIComponent(bookingRef)}`);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const status = str(data.status, 'processing');
    if (TERMINAL_OK.has(status)) return { status, ok: true, failed: false };
    if (TERMINAL_FAIL.has(status)) return { status, ok: false, failed: true };
    await new Promise((r) => setTimeout(r, delays[Math.min(i, delays.length - 1)]));
  }
  return { status: 'processing', ok: false, failed: false };
}

/* ---------------- flights (Duffel) ---------------- */

export interface FlightPassenger {
  title: string; // 'mr' | 'ms' | 'mrs' | 'miss' | 'dr'
  gender: string; // 'm' | 'f'
  givenName: string;
  familyName: string;
  bornOn: string; // YYYY-MM-DD
}

export interface FlightContact {
  email: string;
  phone: string;
}

export interface FlightPaymentIntentResult {
  clientSecret?: string;
  paymentIntentId?: string;
  amount?: string;
  currency?: string;
  bookingRef?: string;
  errorType?: string | null;
  raw: Record<string, unknown>;
}

export async function flightPaymentIntent(args: {
  outOfferId: string;
  outServiceIds?: string[];
}): Promise<FlightPaymentIntentResult> {
  const { ok, status, data } = await postJson('/api/flights/payment-intent', {
    outOfferId: args.outOfferId,
    ...(args.outServiceIds && args.outServiceIds.length
      ? { outServiceIds: args.outServiceIds }
      : {}),
  });
  if (!ok) {
    return {
      errorType: status === 501 ? 'live_booking_disabled' : 'generic',
      raw: data,
    };
  }
  return {
    clientSecret: extractClientSecret(data),
    paymentIntentId: data.paymentIntentId as string | undefined,
    amount: data.amount as string | undefined,
    currency: data.currency as string | undefined,
    bookingRef: data.bookingRef as string | undefined,
    errorType: null,
    raw: data,
  };
}

export function buildFlightOrder(args: {
  outOfferId: string;
  stripePaymentIntentId?: string;
  idempotencyKey: string;
  contact: FlightContact;
  passengers: FlightPassenger[];
  outServiceIds?: string[];
}): Record<string, unknown> {
  return {
    outOfferId: args.outOfferId,
    ...(args.stripePaymentIntentId ? { stripePaymentIntentId: args.stripePaymentIntentId } : {}),
    idempotencyKey: args.idempotencyKey,
    contact: { email: args.contact.email, phone: args.contact.phone },
    passengers: args.passengers.map((p) => ({
      title: p.title,
      gender: p.gender,
      givenName: p.givenName,
      familyName: p.familyName,
      bornOn: p.bornOn,
    })),
    ...(args.outServiceIds && args.outServiceIds.length
      ? { outServiceIds: args.outServiceIds }
      : {}),
  };
}

export async function flightOrder(
  payload: Record<string, unknown>
): Promise<{ bookingRef?: string; status?: string; errorType?: string | null; message?: string; raw: Record<string, unknown> }> {
  const { ok, data } = await postJson('/api/flights/order', payload);
  if (!ok)
    return {
      errorType: 'generic',
      message: str(data.message, 'The airline could not issue this ticket. Your card was not charged.'),
      raw: data,
    };
  return {
    bookingRef: data.bookingRef as string | undefined,
    status: data.status as string | undefined,
    errorType: null,
    raw: data,
  };
}

/** Make a stable idempotency key (so a retried order never double-books). */
export function newIdempotencyKey(): string {
  return uuid();
}

/* ---------------- live cancellation ---------------- */

export interface LiveCancelResult {
  /** The request reached the backend and the booking was cancelled. */
  ok: boolean;
  /** Refund actually issued on the card, when known. */
  refundAmount?: number;
  /** The Stripe refund id, when a refund was issued. */
  refundId?: string;
  /** Where the refund was issued: the backend's cancel, or our direct Stripe. */
  refundSource?: 'backend' | 'stripe';
  /** Backend says this booking can't be cancelled online — route to support. */
  supportRequired: boolean;
  /** Live booking isn't configured — caller falls back to a local cancel. */
  notLive: boolean;
}

function readRefundId(data: Record<string, unknown>): string | undefined {
  if (typeof data.refundId === 'string') return data.refundId;
  const refund = data.refund as Record<string, unknown> | undefined;
  if (refund && typeof refund.id === 'string') return refund.id;
  return undefined;
}

/**
 * Cancel a real supplier booking (hotel or flight) through the service-account
 * proxy, then make sure the refund actually lands on Stripe.
 *
 * The backend's /bookings/cancel owns the order↔PaymentIntent mapping and
 * normally issues the Stripe refund itself — we read that back. Only if it did
 * NOT return a refund, a refund is due, and we hold the PaymentIntent do we
 * issue the Stripe refund ourselves (full or partial). The refund route is
 * idempotent per PaymentIntent, so this can never double-refund.
 *
 * Returns notLive when the server has live booking off (501) so the caller can
 * still record the cancellation locally.
 */
export async function cancelLiveTrip(args: {
  type: string;
  supplierRef: string;
  comment?: string;
  /** Stripe PaymentIntent the booking was charged on (for a direct refund). */
  paymentIntentId?: string;
  /** Refund the traveler is owed per policy (so we can issue it if needed). */
  refundDue?: number;
}): Promise<LiveCancelResult> {
  try {
    const { ok, status, data } =
      args.type === 'flight'
        ? await postJson('/api/flights/cancel', { bookingRef: args.supplierRef })
        : await postJson('/api/bookings/cancel', {
            bookingRef: args.supplierRef,
            cancellationReason: 'user_request',
            cancellationComment: args.comment,
          });

    if (status === 501) return { ok: false, supportRequired: false, notLive: true };
    if (data.errorCode === 'CANCELLATION_REQUIRES_SUPPORT') {
      return { ok, supportRequired: true, notLive: false };
    }

    // Did the backend already refund on Stripe?
    let refundAmount = typeof data.refundAmount === 'number' ? data.refundAmount : undefined;
    let refundId = readRefundId(data);
    let refundSource: 'backend' | 'stripe' | undefined = refundId != null ? 'backend' : undefined;

    // It didn't, a refund is owed, and we hold the PaymentIntent → issue it on
    // Stripe ourselves (idempotent, so safe even if the backend also tries).
    if (
      ok &&
      refundAmount == null &&
      args.refundDue &&
      args.refundDue > 0 &&
      args.paymentIntentId
    ) {
      const r = await postJson('/api/payments/refund', {
        paymentIntentId: args.paymentIntentId,
        amount: args.refundDue,
        bookingRef: args.supplierRef,
      });
      if (r.ok && (r.data.refundId || r.data.status)) {
        refundAmount = typeof r.data.amount === 'number' ? r.data.amount : args.refundDue;
        refundId = r.data.refundId as string | undefined;
        refundSource = 'stripe';
      }
    }

    return { ok, refundAmount, refundId, refundSource, supportRequired: false, notLive: false };
  } catch {
    return { ok: false, supportRequired: false, notLive: false };
  }
}

/** Split a display name into first/last for the supplier guest record. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: 'Guest', lastName: 'Traveler' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
