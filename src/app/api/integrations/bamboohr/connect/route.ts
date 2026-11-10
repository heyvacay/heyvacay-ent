import { NextResponse } from 'next/server';
import { connect } from '@/lib/integrations/bamboohr.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Validate a company's BambooHR subdomain + API key and store the connection. */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const subdomain = String(body.subdomain || '').trim().replace(/^https?:\/\//, '').replace(/\..*$/, '');
  const apiKey = String(body.apiKey || '').trim();
  if (!companyId || !subdomain || !apiKey) {
    return NextResponse.json({ error: 'companyId, subdomain and apiKey are required.' }, { status: 400 });
  }
  try {
    const { count } = await connect(companyId, subdomain, apiKey);
    return NextResponse.json({ ok: true, subdomain, count });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
