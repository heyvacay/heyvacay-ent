import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

// Live search hits the provider every time — never cache the route.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy for flight search. The browser posts the resolved IATA codes and dates;
 * we forward the exact body the HeyVacay backend's /flights/search expects
 * (same contract the consumer site uses — Duffel behind it). Server-side so the
 * enterprise origin needs no CORS allowance and no provider keys touch the client.
 */
export async function POST(req: Request) {
  let incoming: Record<string, unknown>;
  try {
    incoming = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const origin = String(incoming.origin || '').trim().toUpperCase();
  const destination = String(incoming.destination || '').trim().toUpperCase();
  const departDate = String(incoming.departDate || '');
  if (!origin || !destination || !departDate) {
    return NextResponse.json(
      { error: 'origin, destination and departDate are required.' },
      { status: 400 }
    );
  }

  const returnDate = incoming.returnDate ? String(incoming.returnDate) : undefined;
  const tripType = returnDate ? 'return' : 'one-way';

  const payload = {
    origin,
    destination,
    departDate,
    returnDate: tripType === 'return' ? returnDate : undefined,
    tripType,
    cabinClass: String(incoming.cabinClass || 'economy'),
    adults: Number(incoming.adults) || 1,
    directOnly: incoming.directOnly ? true : undefined,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/flights/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Flight search failed (${res.status}).`, detail: data },
        { status: 502 }
      );
    }
    return NextResponse.json(data ?? { offers: [] });
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not reach the flight search service.', detail: String(err) },
      { status: 502 }
    );
  }
}
