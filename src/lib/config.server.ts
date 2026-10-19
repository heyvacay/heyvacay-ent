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
