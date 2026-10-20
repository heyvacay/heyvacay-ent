import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Hotel search — start. Accepts a destination as a region_id, a lat/lng (+radius)
 * geo search, or a pinned hotel (hid), matching how HeyVacay.co turns a picked
 * suggestion into a search. Returns the first page plus the sessionId and
 * hasMore flag so the client can page through the rest via /api/hotels/next.
 */
export async function POST(req: Request) {
  let incoming: Record<string, unknown>;
  try {
    incoming = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const checkin = String(incoming.checkin || '');
  const checkout = String(incoming.checkout || '');
  if (!checkin || !checkout) {
    return NextResponse.json(
      { error: 'checkin and checkout are required.' },
      { status: 400 }
    );
  }

  const regionId = incoming.regionId ? Number(incoming.regionId) : undefined;
  const lat = incoming.lat != null ? Number(incoming.lat) : undefined;
  const lng = incoming.lng != null ? Number(incoming.lng) : undefined;
  const hid = incoming.hid != null ? Number(incoming.hid) : undefined;
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);

  if (!regionId && !hasGeo) {
    return NextResponse.json(
      { error: 'A region or location is required.' },
      { status: 400 }
    );
  }

  const adults = Number(incoming.adults) || 1;
  const pageSize = Number(incoming.pageSize) || 20;

  const payload: Record<string, unknown> = {
    checkin,
    checkout,
    guests: [{ adults, children: [] as number[] }],
    residency: 'US',
    currency: 'USD',
    language: 'en',
    pageSize,
    sortBy: incoming.sortBy ? String(incoming.sortBy) : 'recommended',
    sortOrder: incoming.sortOrder ? String(incoming.sortOrder) : 'asc',
  };
  if (regionId) {
    payload.region_id = regionId;
  } else {
    payload.latitude = lat;
    payload.longitude = lng;
    payload.radius = incoming.radius ? Number(incoming.radius) : 15000;
  }
  if (Number.isFinite(hid)) payload.hid = hid;

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
    // Supplier sometimes returns an empty first page for a valid search.
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

    return NextResponse.json({
      hotels: last.data?.data?.hotels ?? [],
      sessionId: last.data?.sessionId ?? null,
      meta: last.data?.meta ?? {},
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not reach the hotel search service.', detail: String(err) },
      { status: 502 }
    );
  }
}
