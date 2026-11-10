import { NextResponse } from 'next/server';
import { FLIGHT_STATUS } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FlightStatus {
  flightNumber: string;
  date: string;
  status: 'ontime' | 'delayed' | 'cancelled' | 'unknown';
  scheduledDeparture?: string;
  estimatedDeparture?: string;
  delayMinutes?: number;
  gate?: string;
  terminal?: string;
  source: string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/** Deterministic mock so the UI is stable without a key. */
function mockStatus(flightNumber: string, date: string): FlightStatus {
  const seed = hash(`${flightNumber}|${date}`) % 10;
  const status = seed === 9 ? 'cancelled' : seed >= 7 ? 'delayed' : 'ontime';
  return {
    flightNumber,
    date,
    status,
    delayMinutes: status === 'delayed' ? 20 + (seed % 4) * 15 : 0,
    gate: String.fromCharCode(65 + (seed % 6)) + (1 + (seed % 20)),
    terminal: String(1 + (seed % 3)),
    source: 'mock',
  };
}

/**
 * Live flight status. Calls AeroDataBox (RapidAPI) when FLIGHT_STATUS_API_KEY is
 * set, otherwise returns a stable mock so the active-trip view always works.
 * Body: { flightNumber: "UA123", date: "YYYY-MM-DD" }.
 */
export async function POST(req: Request) {
  let body: { flightNumber?: string; date?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty ok */
  }
  const flightNumber = String(body.flightNumber || '').replace(/\s+/g, '').toUpperCase();
  const date = String(body.date || new Date().toISOString().slice(0, 10));
  if (!flightNumber) {
    return NextResponse.json({ error: 'flightNumber is required.' }, { status: 400 });
  }

  if (!FLIGHT_STATUS.live) {
    return NextResponse.json(mockStatus(flightNumber, date));
  }

  try {
    const url = `${FLIGHT_STATUS.base}/flights/number/${encodeURIComponent(flightNumber)}/${encodeURIComponent(date)}?withAircraftImage=false&withLocation=false`;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (FLIGHT_STATUS.isRapidApi) {
      headers['X-RapidAPI-Key'] = FLIGHT_STATUS.apiKey;
      headers['X-RapidAPI-Host'] = FLIGHT_STATUS.host;
    } else {
      headers['Authorization'] = `Bearer ${FLIGHT_STATUS.apiKey}`;
    }
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) return NextResponse.json(mockStatus(flightNumber, date));
    const data = (await res.json().catch(() => null)) as
      | Array<{
          status?: string;
          departure?: {
            scheduledTime?: { local?: string; utc?: string };
            revisedTime?: { local?: string; utc?: string };
            gate?: string;
            terminal?: string;
          };
        }>
      | null;
    const f = Array.isArray(data) ? data[0] : null;
    if (!f) return NextResponse.json(mockStatus(flightNumber, date));

    const raw = (f.status || '').toLowerCase();
    const status: FlightStatus['status'] = raw.includes('cancel')
      ? 'cancelled'
      : raw.includes('delay')
        ? 'delayed'
        : raw.includes('expected') || raw.includes('departed') || raw.includes('arrived') || raw.includes('boarding') || raw.includes('scheduled') || raw.includes('en route')
          ? 'ontime'
          : 'unknown';
    const sched = f.departure?.scheduledTime?.local || f.departure?.scheduledTime?.utc;
    const revised = f.departure?.revisedTime?.local || f.departure?.revisedTime?.utc;
    let delayMinutes = 0;
    if (sched && revised) {
      delayMinutes = Math.max(0, Math.round((Date.parse(revised) - Date.parse(sched)) / 60000));
    }
    return NextResponse.json({
      flightNumber,
      date,
      status,
      scheduledDeparture: sched,
      estimatedDeparture: revised || sched,
      delayMinutes,
      gate: f.departure?.gate,
      terminal: f.departure?.terminal,
      source: 'aerodatabox',
    } satisfies FlightStatus);
  } catch {
    return NextResponse.json(mockStatus(flightNumber, date));
  }
}
