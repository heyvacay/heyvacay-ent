import { NextResponse } from 'next/server';
import { RECEIPT_OCR } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Receipt OCR. The client sends the photographed / uploaded receipt as a data
 * URL; we return the merchant, amount, date and a best-guess category to
 * autopopulate the expense form.
 *
 * When a receipt-OCR provider is configured (RECEIPT_OCR_*), we proxy it with
 * the same keys-live-in-the-backend pattern as the rest of the app. Without a
 * key we derive a stable, plausible result from the image bytes so the feature
 * is fully usable in the demo — the same receipt always reads the same way.
 */

const MERCHANTS = [
  { merchant: 'Blue Bottle Coffee', category: 'Meals', base: 12 },
  { merchant: 'Uber', category: 'Ground transport', base: 24 },
  { merchant: 'Marriott', category: 'Lodging', base: 240 },
  { merchant: 'Delta Air Lines', category: 'Airfare', base: 380 },
  { merchant: 'Shake Shack', category: 'Meals', base: 18 },
  { merchant: 'Hertz', category: 'Ground transport', base: 96 },
  { merchant: 'Office Depot', category: 'Supplies', base: 42 },
  { merchant: 'The Standard Hotel', category: 'Lodging', base: 310 },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

export async function POST(req: Request) {
  let body: { image?: string; filename?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const image = body.image || '';
  if (!image) return NextResponse.json({ error: 'image required' }, { status: 400 });

  // Live provider path.
  if (RECEIPT_OCR.live) {
    try {
      const res = await fetch(`${RECEIPT_OCR.base}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RECEIPT_OCR.apiKey}`,
        },
        body: JSON.stringify({ image }),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.merchant || data?.amount) {
          return NextResponse.json({
            merchant: data.merchant ?? '',
            amount: Number(data.amount) || 0,
            date: data.date ?? new Date().toISOString().slice(0, 10),
            category: data.category ?? 'Other',
            source: 'ocr',
          });
        }
      }
    } catch {
      /* fall through to deterministic parse */
    }
  }

  // Deterministic fallback keyed off the image bytes — same receipt, same read.
  const seed = hash((body.filename || '') + image.slice(0, 512) + image.length);
  const m = MERCHANTS[seed % MERCHANTS.length];
  const cents = (seed % 90) + 10;
  const amount = Math.round((m.base + (seed % 60)) * 100 + cents) / 100;
  const dayOffset = seed % 14; // within the last two weeks
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  return NextResponse.json({
    merchant: m.merchant,
    amount,
    date: d.toISOString().slice(0, 10),
    category: m.category,
    source: 'demo',
  });
}
