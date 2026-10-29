/**
 * Server-only configuration. Imported from route handlers (src/app/api/**),
 * never from client components.
 *
 * The enterprise app does not talk to Duffel / RateHawk directly. It proxies
 * the same HeyVacay backend the consumer site uses, so flight and hotel
 * inventory, prices, and availability are identical to HeyVacay.co. Going
 * through our own backend keeps provider API keys server-side and means we
 * reuse the caching / rate-limiting that already lives there.
 *
 * Base URL resolution: ENT_API_BASE_URL wins (set per environment on the ECS
 * task), otherwise we default to the stage backend so the app is functional
 * out of the box without extra infra wiring.
 */
export const API_BASE_URL =
  process.env.ENT_API_BASE_URL?.replace(/\/+$/, '') ||
  'https://api.stage.heyvacay.co';

/* ---------------------------------------------------------------------------
 * Third-party integrations.
 *
 * Every integration below is designed to "flip on" with a single secret. When
 * the key is absent the proxy routes fall back to realistic mock data so the
 * product is fully demoable today; the moment the secret is set in the ECS
 * task (from Secrets Manager) the same route calls the live API. Nothing in
 * the client changes.
 * ------------------------------------------------------------------------- */

/** OpenTable — restaurant directory, availability, and booking. */
export const OPENTABLE = {
  base:
    process.env.OPENTABLE_API_BASE?.replace(/\/+$/, '') ||
    'https://platform.opentable.com',
  apiKey: process.env.OPENTABLE_API_KEY || '',
  clientId: process.env.OPENTABLE_CLIENT_ID || '',
  clientSecret: process.env.OPENTABLE_CLIENT_SECRET || '',
  get live() {
    return Boolean(this.apiKey || (this.clientId && this.clientSecret));
  },
};

/** Weather — used by the active-trip home view (OpenWeather by default). */
export const WEATHER = {
  base:
    process.env.WEATHER_API_BASE?.replace(/\/+$/, '') ||
    'https://api.openweathermap.org/data/2.5',
  apiKey: process.env.WEATHER_API_KEY || '',
  get live() {
    return Boolean(this.apiKey);
  },
};

/** Flight status — live on-time / delay / gate info for the active-trip view. */
export const FLIGHT_STATUS = {
  base: process.env.FLIGHT_STATUS_API_BASE?.replace(/\/+$/, '') || '',
  apiKey: process.env.FLIGHT_STATUS_API_KEY || '',
  get live() {
    return Boolean(this.apiKey && this.base);
  },
};

/** Transactional email (approvals, dinner invites, offers). */
export const EMAIL = {
  apiKey: process.env.EMAIL_API_KEY || '',
  from: process.env.EMAIL_FROM || 'notifications@heyvacay.co',
  get live() {
    return Boolean(this.apiKey);
  },
};

/** Receipt OCR — reads a photographed / uploaded receipt into expense fields. */
export const RECEIPT_OCR = {
  base: process.env.RECEIPT_OCR_API_BASE?.replace(/\/+$/, '') || '',
  apiKey: process.env.RECEIPT_OCR_API_KEY || '',
  get live() {
    return Boolean(this.apiKey && this.base);
  },
};

/**
 * Stripe — card payments at checkout. Integrated the same way as RateHawk:
 * the booking total's PaymentIntent is created by the shared HeyVacay backend
 * (/bookings/payment/init-stripe), so charges run on the same Stripe account,
 * keys and tracking tags as heyvacay.co. The client only needs the publishable
 * key to mount Stripe Elements — it is NOT secret, and we read the SAME env var
 * the consumer site uses (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) so one key value
 * lights up both apps. A local STRIPE_SECRET_KEY is optional — only used for a
 * direct-to-Stripe fallback when the backend can't mint the intent.
 */
export const STRIPE = {
  base: 'https://api.stripe.com/v1',
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  publishableKey:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    '',
  /** Whether real card entry can be shown (publishable key present). The intent
   *  itself comes from the backend, so the local secret is not required. */
  get live() {
    return Boolean(this.publishableKey);
  },
};
