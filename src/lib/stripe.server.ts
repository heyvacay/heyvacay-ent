import 'server-only';

/**
 * Minimal server-side Stripe client (REST, no SDK) for the enterprise company
 * card: create a Customer, a SetupIntent to save a card off-session, read back
 * the saved card, and charge it off-session later.
 *
 * Uses the ent-local STRIPE_SECRET_KEY, which talks to the SAME Stripe account
 * as the rest of HeyVacay. When the secret isn't set, `stripeConfigured()` is
 * false and the billing UI falls back to the demo card form (nothing is saved
 * or charged).
 */

import { STRIPE } from '@/lib/config.server';

const API = 'https://api.stripe.com/v1';

export function stripeConfigured(): boolean {
  return Boolean(STRIPE.secretKey);
}

interface StripeError {
  error?: { message?: string; code?: string; decline_code?: string };
}

async function stripeFetch<T>(
  path: string,
  init: { method?: 'GET' | 'POST'; form?: Record<string, string>; query?: Record<string, string> } = {},
): Promise<T> {
  if (!STRIPE.secretKey) throw new Error('Stripe is not configured (no secret key).');
  const method = init.method ?? 'GET';
  const qs = init.query ? `?${new URLSearchParams(init.query).toString()}` : '';
  const res = await fetch(`${API}${path}${qs}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE.secretKey}`,
      ...(init.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: init.form ? new URLSearchParams(init.form).toString() : undefined,
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T & StripeError;
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe ${res.status}`);
  }
  return data as T;
}

export interface StripeCustomer {
  id: string;
}
export interface StripeSetupIntent {
  id: string;
  client_secret: string;
  status: string;
  payment_method?: string | null;
}
export interface StripePaymentMethod {
  id: string;
  card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
}
export interface StripePaymentIntent {
  id: string;
  status: string;
}

/** Reuse the given customer, or create a new one tagged with the company id. */
export async function ensureCustomer(
  companyId: string,
  opts: { customerId?: string; name?: string; email?: string } = {},
): Promise<string> {
  if (opts.customerId) return opts.customerId;
  const form: Record<string, string> = { 'metadata[companyId]': companyId };
  if (opts.name) form.name = opts.name;
  if (opts.email) form.email = opts.email;
  const c = await stripeFetch<StripeCustomer>('/customers', { method: 'POST', form });
  return c.id;
}

/** Create a SetupIntent to save a card for off-session (future) charges. */
export async function createSetupIntent(customerId: string): Promise<StripeSetupIntent> {
  return stripeFetch<StripeSetupIntent>('/setup_intents', {
    method: 'POST',
    form: {
      customer: customerId,
      usage: 'off_session',
      'payment_method_types[]': 'card',
    },
  });
}

export async function getSetupIntent(id: string): Promise<StripeSetupIntent> {
  return stripeFetch<StripeSetupIntent>(`/setup_intents/${encodeURIComponent(id)}`);
}

export async function getPaymentMethod(id: string): Promise<StripePaymentMethod> {
  return stripeFetch<StripePaymentMethod>(`/payment_methods/${encodeURIComponent(id)}`);
}

/** Make this payment method the customer's default for future invoices/charges. */
export async function setDefaultPaymentMethod(customerId: string, pmId: string): Promise<void> {
  await stripeFetch(`/customers/${encodeURIComponent(customerId)}`, {
    method: 'POST',
    form: { 'invoice_settings[default_payment_method]': pmId },
  });
}

/**
 * Charge the saved company card off-session (e.g. auto-pay a booking on the
 * company card). Returns the PaymentIntent; a card that needs authentication
 * throws with the Stripe message so the caller can surface it.
 */
export async function chargeOffSession(args: {
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<StripePaymentIntent> {
  const form: Record<string, string> = {
    amount: String(Math.round(args.amountCents)),
    currency: (args.currency || 'usd').toLowerCase(),
    customer: args.customerId,
    payment_method: args.paymentMethodId,
    off_session: 'true',
    confirm: 'true',
  };
  if (args.description) form.description = args.description;
  for (const [k, v] of Object.entries(args.metadata ?? {})) form[`metadata[${k}]`] = v;
  return stripeFetch<StripePaymentIntent>('/payment_intents', { method: 'POST', form });
}
