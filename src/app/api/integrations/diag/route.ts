import { NextResponse } from 'next/server';
import {
  OPENTABLE,
  WEATHER,
  FLIGHT_STATUS,
  EMAIL,
  VERYFI,
  STRIPE,
  RECEIPT_OCR,
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
  ];

  const connected = integrations.filter((i) => i.configured).length;
  return NextResponse.json({
    apiBase: API_BASE_URL,
    connected,
    total: integrations.length,
    integrations,
  });
}
