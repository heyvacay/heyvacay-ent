import { NextResponse } from 'next/server';
import { OPENTABLE } from '@/lib/config.server';
import { getAvailabilityRaw, directoryStats } from '@/lib/opentable.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnostics for the OpenTable integration (stage debugging). Returns the
 * cached directory size and the RAW upstream availability response for a given
 * restaurant, so we can confirm the live response shape. Restaurant data only —
 * no secrets. Example:
 *   /api/restaurants/_diag?rid=12345&date=2026-11-12&time=19:00&party=2
 */
export async function GET(req: Request) {
  if (!OPENTABLE.live) {
    return NextResponse.json({ live: false, message: 'OpenTable not configured.' });
  }
  const url = new URL(req.url);
  const rid = url.searchParams.get('rid') || '';
  const date = url.searchParams.get('date') || '';
  const time = url.searchParams.get('time') || '19:00';
  const party = Number(url.searchParams.get('party')) || 2;

  const dir = await directoryStats();

  let availability: unknown = null;
  if (rid && date) {
    availability = await getAvailabilityRaw({ restaurantId: rid, date, time, partySize: party });
  }

  return NextResponse.json({
    live: true,
    directory: dir,
    availabilityRequest: rid && date ? { rid, date, time, party } : null,
    availabilityRaw: availability,
  });
}
