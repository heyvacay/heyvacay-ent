import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Airport / city typeahead → proxies the backend's /flights/places. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const res = await fetch(
      `${API_BASE_URL}/flights/places?query=${encodeURIComponent(q)}`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    );
    const data = await res.json().catch(() => null);
    const results = Array.isArray(data?.results) ? data.results : [];
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
