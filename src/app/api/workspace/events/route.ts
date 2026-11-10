import { NextResponse } from 'next/server';
import { loadCollection, saveCollection } from '@/lib/workspaceStore.server';
import type { TravelEvent } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-company events sync. Events live in the same company partition as the
 * rest of the workspace, under the `event#` prefix (so they don't collide with
 * users/bookings/etc.).
 *   GET  /api/workspace/events?companyId=... → that company's events
 *   POST /api/workspace/events { companyId, events } → replace them
 */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId') || '';
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }
  try {
    const events = await loadCollection<TravelEvent>(companyId, 'event');
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}

export async function POST(req: Request) {
  let body: { companyId?: string; events?: TravelEvent[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '');
  if (!companyId || !Array.isArray(body.events)) {
    return NextResponse.json({ error: 'companyId and events are required.' }, { status: 400 });
  }
  try {
    await saveCollection(companyId, 'event', body.events);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message || 'Save failed.' }, { status: 500 });
  }
}
