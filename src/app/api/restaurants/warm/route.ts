import { NextResponse } from 'next/server';
import { OPENTABLE } from '@/lib/config.server';
import { primeDirectory } from '@/lib/opentable.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Fire-and-forget: start warming the OpenTable directory cache in the
 * background so the first real search is fast. The Dining page calls this on
 * mount while the traveler is still picking a city.
 */
export async function GET() {
  if (OPENTABLE.live) primeDirectory();
  return NextResponse.json({ ok: true });
}
