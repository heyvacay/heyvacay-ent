import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  BACKEND_SERVICE_TOKEN,
  ENT_COMMISSION_PERCENT,
  isLiveBooking,
} from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Full hotel details (rooms, amenities, images, rules) for the detail page. */
export async function POST(req: Request) {
  let incoming: Record<string, unknown>;
  try {
    incoming = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const hid = Number(incoming.hid);
  const checkin = String(incoming.checkin || '');
  const checkout = String(incoming.checkout || '');
  if (!hid || !checkin || !checkout) {
    return NextResponse.json(
      { error: 'hid, checkin and checkout are required.' },
      { status: 400 }
    );
  }
  const adults = Number(incoming.adults) || 1;

  // Exactly the fields the consumer sends (no currency) — extra keys can trip
  // the supplier's param validation.
  const payload = {
    hid,
    checkin,
    checkout,
    guests: [{ adults, children: [] as number[] }],
    language: 'en',
    residency: 'US',
  };

  // Enterprise channel: present the service token so the backend returns NET
  // (0-commission) prices; the client then marks them up by our commission.
  const live = isLiveBooking();
  const entMarkup = live ? 1 + ENT_COMMISSION_PERCENT / 100 : 1;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (live) {
    headers.Authorization = `Bearer ${BACKEND_SERVICE_TOKEN}`;
    headers['X-HeyVacay-Channel'] = 'enterprise';
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const attempt = async () => {
    const res = await fetch(`${API_BASE_URL}/hotels/details`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  };

  try {
    // The supplier returns transient errors (rate-limit, empty body) as a 200
    // with {status:'error'} or no hotel. The consumer retries those up to 4×;
    // mirror that so a hiccup doesn't surface as "could not load this hotel".
    let last: Awaited<ReturnType<typeof attempt>> | null = null;
    for (let i = 0; i < 4; i++) {
      last = await attempt();
      const d = last.data;
      const transient =
        !last.res.ok ||
        d?.status === 'error' ||
        (d?.error && d.error !== 'invalid_params') ||
        typeof d?.hotel?.name !== 'string' ||
        !d.hotel.name.trim();
      if (!transient) return NextResponse.json({ ...d, entMarkup });
      if (last.res.status === 404 || d?.error === 'invalid_params') break;
      if (i < 3) await sleep(400 * (i + 1));
    }
    return NextResponse.json(
      { error: 'Could not load this hotel.', detail: last?.data ?? null },
      { status: 502 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not reach the hotel details service.', detail: String(err) },
      { status: 502 }
    );
  }
}
