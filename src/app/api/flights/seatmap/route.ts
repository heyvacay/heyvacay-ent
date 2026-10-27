import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Seat map for a flight offer. Calls our backend's Duffel seat-map endpoint
 * (Duffel returns everything we need) and normalizes it to a compact shape the
 * UI renders; falls back to a mock map when the offer/endpoint isn't available.
 *
 * Duffel shape: data[].cabins[].rows[].sections[].elements[] where a seat
 * element carries a `designator` and `available_services` (empty = taken).
 */
interface Seat {
  designator: string;
  column: string;
  available: boolean;
  amount?: number;
  currency?: string;
  serviceId?: string;
}
interface Row {
  label: string;
  seats: Seat[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDuffel(duffel: any): Row[] {
  const maps = duffel?.data ?? [];
  for (const m of maps) {
    for (const cabin of m.cabins ?? []) {
      const rows: Row[] = [];
      for (const row of cabin.rows ?? []) {
        const seats: Seat[] = [];
        for (const sec of row.sections ?? []) {
          for (const el of sec.elements ?? []) {
            if (el.type !== 'seat' || !el.designator) continue;
            const svc = el.available_services?.[0];
            seats.push({
              designator: el.designator,
              column: String(el.designator).replace(/^\d+/, ''),
              available: Array.isArray(el.available_services) && el.available_services.length > 0,
              amount: svc ? Number(svc.total_amount) : undefined,
              currency: svc?.total_currency,
              serviceId: svc?.id,
            });
          }
        }
        if (seats.length) rows.push({ label: String(seats[0].designator).replace(/[A-Z]+$/, ''), seats });
      }
      if (rows.length) return rows; // first cabin with seats
    }
  }
  return [];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function mockSeatMap(offerId: string): Row[] {
  const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
  const rows: Row[] = [];
  for (let r = 10; r <= 24; r++) {
    const seats: Seat[] = cols.map((c) => {
      const h = hash(`${offerId}${r}${c}`);
      const available = h % 10 >= 3;
      const premium = r <= 13 || c === 'A' || c === 'F';
      return {
        designator: `${r}${c}`,
        column: c,
        available,
        amount: available ? (premium ? 29 : 12) : undefined,
        currency: 'USD',
      };
    });
    rows.push({ label: String(r), seats });
  }
  return rows;
}

export async function POST(req: Request) {
  let body: { offerId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const offerId = String(body.offerId || '');
  if (!offerId) return NextResponse.json({ error: 'offerId required' }, { status: 400 });

  try {
    // TODO(duffel): confirm the backend seat-map path; normalizer handles the
    // native Duffel response either way.
    const res = await fetch(`${API_BASE_URL}/flights/seatmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ offerId }),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const rows = normalizeDuffel(data);
      if (rows.length) return NextResponse.json({ rows, source: 'duffel' });
    }
  } catch {
    /* fall through to mock */
  }

  return NextResponse.json({ rows: mockSeatMap(offerId), source: 'mock' });
}
