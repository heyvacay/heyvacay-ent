import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Hotel search. The browser sends the resolved region_id (from the destination
 * picker) plus dates + guests; we call the backend's async region search
 * (/hotels/search/region/start). The supplier sometimes returns an empty first
 * SERP page for a valid search, so we mirror the consumer app's short retry
 * (up to 3 extra attempts, 700ms apart) before giving up. One page (~24) is
 * plenty for the enterprise booking grid, so we don't page with /next here.
 */
export async function POST(req: Request) {
  let incoming: Record<string, unknown>;
  try {
    incoming = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const regionId = Number(incoming.regionId);
  const checkin = String(incoming.checkin || '');
  const checkout = String(incoming.checkout || '');
  if (!regionId || !checkin || !checkout) {
    return NextResponse.json(
      { error: 'regionId, checkin and checkout are required.' },
      { status: 400 }
    );
  }

  const adults = Number(incoming.adults) || 1;
  const payload = {
    checkin,
    checkout,
    region_id: regionId,
    guests: [{ adults, children: [] as number[] }],
    residency: 'US',
    currency: 'USD',
    language: 'en',
    pageSize: 24,
    sortBy: 'price',
    sortOrder: 'asc',
  };

  const call = async () => {
    const res = await fetch(`${API_BASE_URL}/hotels/search/region/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  };

  try {
    let last = await call();
    for (let i = 0; i < 3; i++) {
      const hotels = last.data?.data?.hotels;
      if (!last.ok || (Array.isArray(hotels) && hotels.length > 0)) break;
      await sleep(700);
      last = await call();
    }

    if (!last.ok) {
      return NextResponse.json(
        { error: `Hotel search failed (${last.status}).`, detail: last.data },
        { status: 502 }
      );
    }

    const hotels = last.data?.data?.hotels ?? [];
    return NextResponse.json({ hotels, meta: last.data?.meta ?? {} });
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not reach the hotel search service.', detail: String(err) },
      { status: 502 }
    );
  }
}
