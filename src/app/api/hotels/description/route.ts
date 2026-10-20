import { NextResponse } from 'next/server';
import { API_BASE_URL } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** About-the-property description paragraphs, fetched by hid. */
export async function POST(req: Request) {
  let incoming: Record<string, unknown>;
  try {
    incoming = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const hid = Number(incoming.hid);
  if (!hid) return NextResponse.json({ error: 'hid is required.' }, { status: 400 });

  try {
    const res = await fetch(`${API_BASE_URL}/hotels/details/description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ hid }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return NextResponse.json({}, { status: 200 });
    return NextResponse.json(data ?? {});
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
