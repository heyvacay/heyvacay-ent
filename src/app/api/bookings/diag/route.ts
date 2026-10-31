import { NextResponse } from 'next/server';
import { API_BASE_URL, isLiveBooking } from '@/lib/config.server';
import { backendFetch } from '@/lib/backendAuth.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live-booking diagnostics. Visit /api/bookings/diag to see whether real
 * supplier booking is actually wired: are the service-account credentials set,
 * and do they log in against the backend. No secrets are returned — only
 * booleans, the (non-secret) API base, HTTP status and a short sanitized
 * sample — so it's safe to read while debugging staging.
 */
export async function GET() {
  const configured = isLiveBooking();
  if (!configured) {
    return NextResponse.json({
      liveBooking: false,
      authOk: false,
      apiBase: API_BASE_URL,
      reason:
        'Service account not configured — set ENT_BACKEND_EMAIL and ENT_BACKEND_PASSWORD on the ECS task (Secrets Manager). Until then real bookings cannot be issued.',
    });
  }
  try {
    // An authenticated GET proves the service account logs in and the bearer
    // works. /auth/profile returns the signed-in account.
    const res = await backendFetch('/auth/profile', { method: 'GET' });
    const text = await res.text().catch(() => '');
    return NextResponse.json({
      liveBooking: true,
      authOk: res.ok,
      status: res.status,
      apiBase: API_BASE_URL,
      sample: text.slice(0, 300),
    });
  } catch (e) {
    return NextResponse.json({
      liveBooking: true,
      authOk: false,
      apiBase: API_BASE_URL,
      error: (e as Error).message,
    });
  }
}
