'use client';

export interface Seat {
  designator: string;
  column: string;
  available: boolean;
  amount?: number;
  currency?: string;
  serviceId?: string;
}
export interface SeatRow {
  label: string;
  seats: Seat[];
}

export async function getSeatMap(offerId: string): Promise<{ rows: SeatRow[]; source?: string }> {
  try {
    const res = await fetch('/api/flights/seatmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerId }),
    });
    const data = await res.json().catch(() => null);
    return { rows: Array.isArray(data?.rows) ? data.rows : [], source: data?.source };
  } catch {
    return { rows: [] };
  }
}
