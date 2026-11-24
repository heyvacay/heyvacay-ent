import { NextResponse } from 'next/server';
import { uberTripStatus } from '@/lib/integrations/uber.server';
import { lyftRideStatus } from '@/lib/integrations/lyft.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/rideshare/status?provider=uber|lyft&id=... */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider');
  const id = url.searchParams.get('id');
  if (!provider || !id) {
    return NextResponse.json({ error: 'provider and id are required' }, { status: 400 });
  }
  try {
    const r = provider === 'uber' ? await uberTripStatus(id) : await lyftRideStatus(id);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ status: 'unknown', error: (e as Error).message }, { status: 200 });
  }
}
