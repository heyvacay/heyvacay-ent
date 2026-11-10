import { NextResponse } from 'next/server';
import { OPENTABLE } from '@/lib/config.server';
import { cancelReservation } from '@/lib/opentable.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cancel a dining reservation on OpenTable (best-effort). */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const restaurantId = String(body.restaurantId || '');
  const confirmation = String(body.confirmation || '');
  if (!restaurantId || !confirmation) {
    return NextResponse.json({ error: 'restaurantId and confirmation are required.' }, { status: 400 });
  }
  if (!OPENTABLE.live) {
    return NextResponse.json({ cancelled: true, source: 'local' });
  }
  const r = await cancelReservation({ restaurantId, confirmation });
  return NextResponse.json({ cancelled: r.ok, status: r.status, source: 'opentable' });
}
