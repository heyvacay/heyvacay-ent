import { NextResponse } from 'next/server';
import { uberCancel } from '@/lib/integrations/uber.server';
import { lyftCancel } from '@/lib/integrations/lyft.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/rideshare/cancel { provider, id } */
export async function POST(req: Request) {
  let b: { provider?: string; id?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!b.provider || !b.id) {
    return NextResponse.json({ error: 'provider and id are required' }, { status: 400 });
  }
  try {
    if (b.provider === 'uber') await uberCancel(b.id);
    else await lyftCancel(b.id);
    return NextResponse.json({ cancelled: true });
  } catch (e) {
    return NextResponse.json({ cancelled: false, error: (e as Error).message }, { status: 200 });
  }
}
