import { NextResponse } from 'next/server';
import {
  OPENTABLE,
  WEATHER,
  FLIGHT_STATUS,
  EMAIL,
  VERYFI,
  STRIPE,
  RECEIPT_OCR,
  QUICKBOOKS,
  XERO,
  GUSTO,
  GOOGLE_WS,
  SLACK,
  INTEGRATIONS_TABLE,
  isLiveBooking,
  API_BASE_URL,
} from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One place to see whether every integration's keys actually reached the running
 * container. GET /api/integrations/diag returns a boolean per integration (no
 * secret values) so staging can be verified at a glance after a secret + deploy.
 *
 * Each `configured:true` means "the key is present and the live path is on";
 * until then the feature runs on its built-in mock/fallback.
 */
export function GET() {
  const integrations = [
    {
      key: 'live_booking',
      name: 'Live booking — enterprise channel (flights + hotels)',
      configured: isLiveBooking(),
      powers: 'Real supplier orders + unattended approve-to-book',
      verify: '/api/bookings/diag',
    },
    {
      key: 'stripe',
      name: 'Stripe — card payments',
      configured: STRIPE.live,
      powers: 'Checkout card entry (intent minted by the backend)',
    },
    {
      key: 'veryfi',
      name: 'Veryfi — receipt OCR',
      configured: VERYFI.live,
      powers: 'Scan a receipt → expense fields',
      verify: '/api/expenses/scan',
    },
    {
      key: 'opentable',
      name: 'OpenTable — restaurant search + reservations',
      configured: OPENTABLE.live,
      powers: 'Dining search, availability, booking',
    },
    {
      key: 'weather',
      name: 'Weather — active-trip forecast',
      configured: WEATHER.live,
      powers: 'Destination weather on the trip view',
    },
    {
      key: 'flight_status',
      name: 'Flight status — live on-time / gate',
      configured: FLIGHT_STATUS.live,
      powers: 'Live flight status on the active-trip view',
    },
    {
      key: 'email',
      name: 'Transactional email',
      configured: EMAIL.live,
      powers: 'Approvals, confirmations, dinner invites',
    },
    {
      key: 'receipt_ocr_generic',
      name: 'Generic receipt OCR (fallback provider)',
      configured: RECEIPT_OCR.live,
      powers: 'Alternate OCR provider (Veryfi preferred)',
    },
    {
      key: 'quickbooks',
      name: 'QuickBooks Online — accounting sync (OAuth2)',
      // "configured" here means the Intuit APP is wired (connect is possible);
      // each company still connects its own QuickBooks via OAuth on the
      // Integrations page. Per-company connection state isn't a global flag.
      configured: QUICKBOOKS.configured,
      powers: 'Connect QuickBooks, map GL accounts, post expenses as Purchases',
      verify: '/app/integrations/quickbooks',
      env: QUICKBOOKS.env,
      tokenStore: INTEGRATIONS_TABLE,
    },
    {
      key: 'xero',
      name: 'Xero — accounting sync (OAuth2)',
      configured: XERO.configured,
      powers: 'Connect Xero, map accounts, post expenses as spend transactions',
      verify: '/app/integrations/xero',
    },
    {
      key: 'bamboohr',
      name: 'BambooHR — roster sync (per-company API key)',
      // Per-company: connected in the UI with the company's own key, so there's
      // no global server flag — always "ready", connection state is per workspace.
      configured: true,
      powers: 'Import the employee directory into the workspace',
      verify: '/app/integrations/bamboohr',
    },
    {
      key: 'slack',
      name: SLACK.configured
        ? 'Slack — notifications (one-click "Add to Slack" app ✓ configured; manual webhook also works)'
        : 'Slack — notifications (manual webhook works; set SLACK_CLIENT_ID/SECRET for one-click "Add to Slack")',
      configured: true,
      powers: 'Approval requests + trip alerts to a Slack channel',
      verify: '/app/integrations/slack',
    },
    { key: 'gusto', name: 'Gusto — roster sync (OAuth2)', configured: GUSTO.configured, powers: 'Import employees', verify: '/app/integrations/gusto' },
    { key: 'google', name: 'Google Workspace — user sync (OAuth2)', configured: GOOGLE_WS.configured, powers: 'Import directory users', verify: '/app/integrations/google' },
    // Per-company (admin enters their own credentials in the UI) — always "ready".
    { key: 'rippling', name: 'Rippling — roster sync (per-company API key)', configured: true, powers: 'Import employees', verify: '/app/integrations/rippling' },
    { key: 'okta', name: 'Okta — user sync (per-company API token)', configured: true, powers: 'Import users', verify: '/app/integrations/okta' },
    { key: 'workday', name: 'Workday — worker sync (per-company RaaS)', configured: true, powers: 'Import workers', verify: '/app/integrations/workday' },
    { key: 'ukg', name: 'UKG Pro — roster sync (per-company API key + service account)', configured: true, powers: 'Import employees', verify: '/app/integrations/ukg' },
    { key: 'ramp', name: 'Ramp — card feed (per-company API creds)', configured: true, powers: 'Recent card transactions', verify: '/app/integrations/ramp' },
    { key: 'brex', name: 'Brex — card feed (per-company API token)', configured: true, powers: 'Recent card transactions', verify: '/app/integrations/brex' },
    { key: 'netsuite', name: 'NetSuite — accounting (per-company TBA)', configured: true, powers: 'Map accounts + post journal entries', verify: '/app/integrations/netsuite' },
    { key: 'expensify', name: 'Expensify — link (per-company partner creds)', configured: true, powers: 'Validate + list policies', verify: '/app/integrations/expensify' },
  ];

  const connected = integrations.filter((i) => i.configured).length;
  return NextResponse.json({
    apiBase: API_BASE_URL,
    connected,
    total: integrations.length,
    integrations,
  });
}
