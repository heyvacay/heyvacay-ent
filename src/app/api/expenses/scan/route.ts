import { NextResponse } from 'next/server';
import { RECEIPT_OCR, VERYFI } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnostic: GET /api/expenses/scan shows whether the OCR keys actually
 * reached this running container (no secrets are exposed). If veryfi.configured
 * is false, the VERYFI_* env vars aren't on the ENT task yet — add them to the
 * ENT service's secret and wire the task, then redeploy.
 */
export async function GET() {
  return NextResponse.json({
    veryfi: { configured: VERYFI.live, base: VERYFI.base },
    generic: { configured: RECEIPT_OCR.live },
  });
}

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

  // Why the Veryfi path didn't return a result (surfaced to the client so a
  // misconfigured key isn't silently masked by the demo fallback).
  let veryfiError: string | null = VERYFI.live ? null : 'not configured';

  // Veryfi provider path (our standard receipt-OCR provider). Veryfi accepts a
  // base64 payload with the data-URL prefix stripped; map its response to the
  // fields the expense form autopopulates.
  if (VERYFI.live) {
    try {
      const base64 = image.includes(',') ? image.slice(image.indexOf(',') + 1) : image;
      const res = await fetch(`${VERYFI.base}/documents/`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'CLIENT-ID': VERYFI.clientId,
          AUTHORIZATION: `apikey ${VERYFI.username}:${VERYFI.apiKey}`,
        },
        body: JSON.stringify({
          file_data: base64,
          file_name: body.filename || 'receipt.jpg',
        }),
        cache: 'no-store',
      });
      if (res.ok) {
        const d = await res.json().catch(() => null);
        const merchant = d?.vendor?.name ?? d?.vendor?.raw_name ?? '';
        const amount = Number(d?.total) || 0;
        if (merchant || amount) {
          return NextResponse.json({
            merchant,
            amount,
            date: (d?.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
            category: d?.category ?? 'Other',
            source: 'veryfi',
          });
        }
        veryfiError = 'empty result';
      } else {
        const text = await res.text().catch(() => '');
        veryfiError = `HTTP ${res.status} ${text.slice(0, 160)}`.trim();
      }
    } catch (e) {
      veryfiError = `request failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 180);
    }
  }

  // Generic provider path (RECEIPT_OCR_*).
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
    veryfiError,
  });
}
