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

/**
 * Service account the Enterprise app logs in as, server-side, to issue REAL
 * supplier bookings (Duffel flights / RateHawk hotels) through the shared
 * backend — the same endpoints heyvacay.co books through. All Enterprise
 * bookings run under this one corporate account (so they show in the backend's
 * my-bookings / billing). Credentials live only on the ECS task (Secrets
 * Manager), never on the client.
 *
 * When these are absent, live booking is OFF and the app falls back to
 * recording the trip in the workspace (no supplier order, no charge) — so the
 * product keeps working until the account is wired.
 */
export const BACKEND_AUTH = {
  email: process.env.ENT_BACKEND_EMAIL || '',
  password: process.env.ENT_BACKEND_PASSWORD || '',
};

/**
 * The backend's enterprise service token (matches ENTERPRISE_SERVICE_TOKEN on
 * the HeyVacay backend). Presented as the bearer on every booking call — the
 * backend authenticates it as the enterprise service account, no human OTP.
 * This is how live booking is wired (the old email/password login never
 * existed on the backend, which is email-OTP only).
 */
export const BACKEND_SERVICE_TOKEN = process.env.ENT_BACKEND_SERVICE_TOKEN || '';

/** Enterprise commission applied on top of the supplier NET, as a percent of
 *  net (e.g. 10 → customer pays net × 1.10). */
export const ENT_COMMISSION_PERCENT = Number(process.env.ENT_COMMISSION_PERCENT || '10');

/** True when real supplier booking is enabled (service token configured). */
export function isLiveBooking(): boolean {
  return Boolean(BACKEND_SERVICE_TOKEN);
}

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

/**
 * Flight status — live on-time / delay / gate info for the active-trip view.
 * Defaults to AeroDataBox via RapidAPI (easiest to sign up for), so it's
 * turn-key with just the RapidAPI key. For FlightAware or another provider,
 * override FLIGHT_STATUS_API_BASE (+ _HOST if it uses a RapidAPI host header).
 */
export const FLIGHT_STATUS = {
  base:
    process.env.FLIGHT_STATUS_API_BASE?.replace(/\/+$/, '') ||
    'https://aerodatabox.p.rapidapi.com',
  apiKey: process.env.FLIGHT_STATUS_API_KEY || '',
  /** RapidAPI host header value; empty for a non-RapidAPI provider (Bearer auth). */
  host: process.env.FLIGHT_STATUS_API_HOST || 'aerodatabox.p.rapidapi.com',
  get live() {
    return Boolean(this.apiKey && this.base);
  },
  /** True when the base is a RapidAPI host (use X-RapidAPI-* headers). */
  get isRapidApi() {
    return /rapidapi\.com$/.test(this.host) || this.base.includes('rapidapi.com');
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
 * Veryfi — receipt OCR provider we're standardizing on. Set these three in the
 * backend secret / environment to turn on live scanning (the keys never reach
 * the browser):
 *   VERYFI_CLIENT_ID     — your Veryfi Client ID
 *   VERYFI_USERNAME      — your Veryfi username
 *   VERYFI_API_KEY       — your Veryfi API key
 * Optional:
 *   VERYFI_API_BASE      — defaults to Veryfi's v8 partner endpoint host.
 *   VERYFI_CLIENT_SECRET — NOT needed to authenticate. Veryfi uses it only for
 *     the optional HMAC request signature (X-Veryfi-Request-Signature /
 *     -Timestamp), an extra layer mainly for browser-side calls. Our scan runs
 *     server-side with CLIENT-ID + apikey auth, so this is reserved/unused
 *     unless your Veryfi account enforces signature verification.
 */
export const VERYFI = {
  clientId: process.env.VERYFI_CLIENT_ID || '',
  username: process.env.VERYFI_USERNAME || '',
  apiKey: process.env.VERYFI_API_KEY || '',
  /** Reserved: only used if Veryfi signature verification is enabled. */
  clientSecret: process.env.VERYFI_CLIENT_SECRET || '',
  base: (process.env.VERYFI_API_BASE || 'https://api.veryfi.com/api/v8/partner').replace(/\/+$/, ''),
  get live() {
    return Boolean(this.clientId && this.username && this.apiKey);
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

/**
 * QuickBooks Online — real accounting sync (OAuth2 + Accounting API).
 *
 * Unlike the single-secret integrations above, QBO is a full OAuth2
 * authorization-code integration. Each company connects its own QuickBooks via
 * Intuit's consent screen; we store the resulting per-company tokens
 * server-side (DynamoDB) and post approved expenses as QuickBooks Purchases
 * against the mapped chart-of-accounts.
 *
 * Secrets (set on the ECS task from Secrets Manager — never reach the browser):
 *   QUICKBOOKS_CLIENT_ID      — Intuit app client id
 *   QUICKBOOKS_CLIENT_SECRET  — Intuit app client secret
 * Non-secret env (plain, on ent.tf):
 *   QUICKBOOKS_ENV            — "sandbox" (default) or "production"; picks the API host
 *   QUICKBOOKS_REDIRECT_URI   — must EXACTLY match a Redirect URI registered on the
 *                               Intuit app (default: the stage callback below)
 *
 * When client id/secret are absent the Integrations UI shows QBO as needing the
 * Intuit app wired — no fake "connected" state.
 */
export const QUICKBOOKS = {
  clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
  /** "sandbox" | "production" — selects the Accounting API host. */
  env: (process.env.QUICKBOOKS_ENV || 'sandbox').toLowerCase(),
  redirectUri:
    process.env.QUICKBOOKS_REDIRECT_URI ||
    'https://ent.stage.heyvacay.co/api/integrations/quickbooks/callback',
  /** Intuit's hosted consent screen. */
  authorizeUrl:
    process.env.QUICKBOOKS_OAUTH_AUTHORIZE ||
    'https://appcenter.intuit.com/connect/oauth2',
  /** OAuth2 token endpoint (code exchange + refresh). */
  tokenUrl:
    process.env.QUICKBOOKS_OAUTH_TOKEN ||
    'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  scope: 'com.intuit.quickbooks.accounting',
  /** Accounting API base, chosen by env (override with QUICKBOOKS_API_BASE). */
  get apiBase(): string {
    const override = process.env.QUICKBOOKS_API_BASE?.replace(/\/+$/, '');
    if (override) return override;
    return this.env === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  },
  /** QBO minorversion pinned so request/response shape is stable. */
  minorVersion: process.env.QUICKBOOKS_MINOR_VERSION || '70',
  /** True once the Intuit app credentials are wired (connect is possible). */
  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  },
};

/**
 * Xero — real accounting sync (OAuth2 + Accounting API), same shape as QuickBooks.
 * Each company connects its own Xero organisation; approved expenses post as
 * Xero spend bank transactions against the mapped account codes.
 *
 * Secrets: XERO_CLIENT_ID, XERO_CLIENT_SECRET.
 * Non-secret env: XERO_REDIRECT_URI (must match a Redirect URI on the Xero app).
 */
export const XERO = {
  clientId: process.env.XERO_CLIENT_ID || '',
  clientSecret: process.env.XERO_CLIENT_SECRET || '',
  redirectUri:
    process.env.XERO_REDIRECT_URI ||
    'https://ent.stage.heyvacay.co/api/integrations/xero/callback',
  authorizeUrl: process.env.XERO_OAUTH_AUTHORIZE || 'https://login.xero.com/identity/connect/authorize',
  tokenUrl: process.env.XERO_OAUTH_TOKEN || 'https://identity.xero.com/connect/token',
  // offline_access gives us a refresh token; the rest are the accounting scopes.
  scope:
    process.env.XERO_SCOPE ||
    'offline_access accounting.transactions accounting.settings.read accounting.contacts',
  apiBase: (process.env.XERO_API_BASE || 'https://api.xero.com').replace(/\/+$/, ''),
  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  },
  /** Xero is always "production" (it has no separate sandbox host — use a demo org). */
  env: 'production',
};

/**
 * Gusto — HR roster sync (OAuth2). Shared app; each company authorizes its own
 * Gusto. Secrets: GUSTO_CLIENT_ID, GUSTO_CLIENT_SECRET. Non-secret: GUSTO_REDIRECT_URI.
 * GUSTO_API_BASE defaults to the demo host; set it to the production host to go live.
 */
export const GUSTO = {
  clientId: process.env.GUSTO_CLIENT_ID || '',
  clientSecret: process.env.GUSTO_CLIENT_SECRET || '',
  redirectUri:
    process.env.GUSTO_REDIRECT_URI ||
    'https://ent.stage.heyvacay.co/api/integrations/roster/gusto/callback',
  apiBase: (process.env.GUSTO_API_BASE || 'https://api.gusto-demo.com').replace(/\/+$/, ''),
  authorizeUrl: process.env.GUSTO_OAUTH_AUTHORIZE || '', // defaults to `${apiBase}/oauth/authorize`
  tokenUrl: process.env.GUSTO_OAUTH_TOKEN || '', // defaults to `${apiBase}/oauth/token`
  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  },
};

/**
 * Google Workspace — directory user sync (OAuth2, Admin SDK). The authorizing
 * user must be a Workspace admin. Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 * Non-secret: GOOGLE_REDIRECT_URI.
 */
export const GOOGLE_WS = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    'https://ent.stage.heyvacay.co/api/integrations/roster/google/callback',
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: 'openid email https://www.googleapis.com/auth/admin.directory.user.readonly',
  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  },
};

/**
 * Slack — ONE shared HeyVacay Slack app so a customer connects with a single
 * "Add to Slack" click (OAuth, incoming-webhook scope) instead of building their
 * own app. Secrets: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET. Non-secret:
 * SLACK_REDIRECT_URI (must EXACTLY match a Redirect URL in the Slack app's OAuth
 * settings). When unset, the app falls back to the manual "paste a webhook URL"
 * flow, so Slack still works without the platform app.
 */
export const SLACK = {
  clientId: process.env.SLACK_CLIENT_ID || '',
  clientSecret: process.env.SLACK_CLIENT_SECRET || '',
  redirectUri:
    process.env.SLACK_REDIRECT_URI ||
    'https://ent.stage.heyvacay.co/api/integrations/slack/callback',
  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  },
};

/**
 * DynamoDB table holding per-company integration connections (OAuth tokens +
 * account mappings). The ENT ECS task role is granted access to this one table.
 * When unset / unreachable, tokenStore falls back to an in-process map so local
 * dev and the build keep working (tokens just don't survive a restart).
 */
export const INTEGRATIONS_TABLE =
  process.env.INTEGRATIONS_DDB_TABLE || 'stage-heyvacay-ent-integrations';

/** Per-company workspace table (users, policies, budgets, bookings, expenses,
 *  events and settings — one normalized item per entity). */
export const WORKSPACE_TABLE =
  process.env.WORKSPACE_DDB_TABLE || 'stage-heyvacay-ent-workspace';

export const AWS_REGION = process.env.AWS_REGION || 'us-west-2';

/**
 * Secret used to HMAC-sign the OAuth `state` parameter so the callback can
 * trust the company id it carries. Defaults to the enterprise service token
 * (already a per-env secret); override with QUICKBOOKS_STATE_SECRET.
 */
export const OAUTH_STATE_SECRET =
  process.env.QUICKBOOKS_STATE_SECRET ||
  process.env.ENT_BACKEND_SERVICE_TOKEN ||
  'hv-ent-oauth-state-fallback';
