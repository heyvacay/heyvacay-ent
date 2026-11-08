/**
 * On-approve auto-booking.
 *
 * When a manager approves a booking that was submitted for approval, this runs
 * the SAME live supplier sequence the attended checkout uses — but unattended:
 *   hotel  : prebook → (re-price) → form → payment-init → confirm → poll
 *   flight : payment-intent (re-price) → order
 * paying with the enterprise service account (the proxy attaches the service
 * token, so the backend prices NET and settles supplier payment server-side —
 * no human card entry, no OTP).
 *
 * It never fabricates a result:
 *   - live booking off on the server (501) → { status: 'live_off' }  (caller
 *     falls back to the legacy local confirm, so stage keeps working until the
 *     enterprise token is live).
 *   - supplier price moved beyond tolerance → { status: 'price_changed' } and we
 *     do NOT book — the traveler re-confirms at the new price.
 *   - sold out → 'unavailable'; payment couldn't settle → 'needs_payment';
 *     flight passenger profile incomplete → 'needs_details'.
 *   - real order placed → { status: 'booked', supplierRef, amount }.
 */

import type { LiveBookingContext } from './types';
import {
  prebook,
  bookingForm,
  choosePaymentType,
  paymentInit,
  buildConfirmPayload,
  confirmBooking,
  pollStatus,
  flightPaymentIntent,
  buildFlightOrder,
  flightOrder,
  newIdempotencyKey,
} from './liveBooking';

export type AutoBookResult =
  | { status: 'booked'; supplierRef?: string; amount: number }
  | { status: 'price_changed'; oldAmount: number; newAmount: number }
  | { status: 'unavailable'; message?: string }
  | { status: 'needs_payment'; message?: string }
  | { status: 'needs_details'; message?: string }
  | { status: 'live_off' }
  | { status: 'error'; message?: string };

/** A supplier price move only matters past a small tolerance (rounding / FX). */
function movedBeyondTolerance(oldAmount: number, newAmount: number): boolean {
  const tol = Math.max(2, oldAmount * 0.01);
  return Math.abs(newAmount - oldAmount) > tol && newAmount > oldAmount;
}

function hasCompletePassenger(p: {
  title?: string;
  gender?: string;
  givenName?: string;
  familyName?: string;
  bornOn?: string;
}): boolean {
  return Boolean(p.title && p.gender && p.givenName && p.familyName && p.bornOn);
}

async function autoBookHotel(
  ctx: Extract<LiveBookingContext, { kind: 'hotel' }>
): Promise<AutoBookResult> {
  // 1) Re-price / re-hold the rate with the supplier.
  const pre = await prebook(ctx.prebook);
  if (pre.errorType === 'live_booking_disabled') return { status: 'live_off' };
  if (pre.errorType === 'no_longer_available')
    return { status: 'unavailable', message: pre.message };
  if (!pre.bookingRef) {
    if (pre.errorType === 'price_changed') {
      return {
        status: 'price_changed',
        oldAmount: ctx.amount,
        newAmount: pre.priceChange?.newAmount ?? ctx.amount,
      };
    }
    return { status: 'error', message: pre.message };
  }

  // Supplier confirmed a price — if it moved up materially, don't book.
  if (pre.priceChange && movedBeyondTolerance(pre.priceChange.previousAmount || ctx.amount, pre.priceChange.newAmount)) {
    return {
      status: 'price_changed',
      oldAmount: pre.priceChange.previousAmount || ctx.amount,
      newAmount: pre.priceChange.newAmount,
    };
  }

  const amount = pre.priceChange?.newAmount ?? ctx.amount;

  // 2) Booking form → pick the "pay now" payment type.
  const form = await bookingForm(pre.bookingRef);
  if (form.errorType) return { status: 'unavailable', message: 'Rate no longer available.' };
  const pay = choosePaymentType(form.paymentTypes);
  const payAmount = pay ? Number(pay.amount) || amount : amount;

  // 3) Payment init (enterprise service account settles server-side).
  const init = await paymentInit({
    bookingRef: pre.bookingRef,
    amount: payAmount,
    currency: ctx.currency || 'USD',
  });
  if (init.errorType) return { status: 'needs_payment', message: 'Company payment could not be initialised.' };

  // 4) Confirm — no client paymentIntentId: the service-token backend pays.
  const confirmPayload = buildConfirmPayload({
    bookingRef: pre.bookingRef,
    bookHash: ctx.bookHash,
    guest: ctx.guest,
    amount: payAmount,
    payUuid: init.payUuid,
    initUuid: init.initUuid,
  });
  const confirmed = await confirmBooking(confirmPayload);
  if (confirmed.errorType) return { status: 'needs_payment', message: confirmed.message };

  // 5) Poll to a terminal state.
  const ref = confirmed.bookingRef ?? pre.bookingRef;
  const poll = await pollStatus(ref);
  if (poll.failed) return { status: 'error', message: `Supplier booking ${poll.status}.` };
  // "processing" (not yet terminal) is still a placed order — treat as booked.
  return { status: 'booked', supplierRef: ref, amount: payAmount };
}

async function autoBookFlight(
  ctx: Extract<LiveBookingContext, { kind: 'flight' }>
): Promise<AutoBookResult> {
  // 1) Re-price with Duffel (also validates the offer is still live).
  const intent = await flightPaymentIntent({
    outOfferId: ctx.outOfferId,
    outServiceIds: ctx.outServiceIds,
  });
  if (intent.errorType === 'live_booking_disabled') return { status: 'live_off' };
  if (intent.errorType) return { status: 'unavailable', message: 'This fare is no longer available.' };

  const newAmount = intent.amount != null ? Number(intent.amount) : ctx.amount;
  if (movedBeyondTolerance(ctx.amount, newAmount)) {
    return { status: 'price_changed', oldAmount: ctx.amount, newAmount };
  }

  // 2) Passenger profile must be complete to issue a ticket.
  if (!ctx.passengers.length || !ctx.passengers.every(hasCompletePassenger)) {
    return { status: 'needs_details', message: 'Traveler date of birth / title is required to issue the ticket.' };
  }

  // 3) Place the order (service-token backend settles payment server-side).
  const order = await flightOrder(
    buildFlightOrder({
      outOfferId: ctx.outOfferId,
      idempotencyKey: newIdempotencyKey(),
      contact: ctx.contact,
      passengers: ctx.passengers,
      outServiceIds: ctx.outServiceIds,
      seatPreference: ctx.seatPreference,
    })
  );
  if (order.errorType) {
    const msg = order.message ?? '';
    // A payment/charge failure → company card couldn't settle; else generic.
    if (/payment|charge|card|declin/i.test(msg)) return { status: 'needs_payment', message: msg };
    return { status: 'error', message: msg };
  }
  return { status: 'booked', supplierRef: order.bookingRef, amount: newAmount };
}

/** Attempt the real supplier booking for an approved item. Never throws. */
export async function autoBookOnApproval(ctx: LiveBookingContext): Promise<AutoBookResult> {
  try {
    return ctx.kind === 'hotel' ? await autoBookHotel(ctx) : await autoBookFlight(ctx);
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Auto-book failed.' };
  }
}
