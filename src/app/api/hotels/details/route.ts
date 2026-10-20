import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

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

  const payload = {
    hid,
    checkin,
    checkout,
    guests: [{ adults, children: [] as number[] }],
    residency: 'US',
    currency: 'USD',
    language: 'en',
  };

  try {
    const res = await fetch(`${API_BASE_URL}/hotels/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Hotel details failed (${res.status}).` },
        { status: 502 }
      );
    }
    return NextResponse.json(data ?? {});
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not reach the hotel details service.', detail: String(err) },
      { status: 502 }
    );
  }
}
