import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hotel search — next page. The supplier keeps the full result set behind the
 * sessionId from /start, so each call just advances the cursor. The client
 * loops this (background backfill + infinite scroll) until meta.hasMore is
 * false, which is how HeyVacay.co loads every hotel for a search.
 */
export async function POST(req: Request) {
  let incoming: Record<string, unknown>;
  try {
    incoming = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const sessionId = String(incoming.sessionId || '');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
  }
  const pageSize = Number(incoming.pageSize) || 20;

  try {
    const res = await fetch(`${API_BASE_URL}/hotels/search/region/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sessionId, pageSize }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Next page failed (${res.status}).` },
        { status: 502 }
      );
    }
    return NextResponse.json({
      hotels: data?.data?.hotels ?? [],
      meta: data?.meta ?? {},
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not reach the hotel search service.', detail: String(err) },
      { status: 502 }
    );
  }
}
