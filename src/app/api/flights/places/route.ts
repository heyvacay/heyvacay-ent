import { NextResponse } from 'next/server';
import { browseFetchJson } from '@/lib/backendAuth.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Airport / city typeahead → proxies the backend's /flights/places. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    // Resilient: authenticated first, auto-falls back to guest browse if the
    // enterprise token is missing/drifted/rejected (see browseFetchJson).
    const data = (await browseFetchJson(
      `/flights/places?query=${encodeURIComponent(q)}`
    )) as { results?: unknown[] } | null;
    const results = Array.isArray(data?.results) ? data.results : [];
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
