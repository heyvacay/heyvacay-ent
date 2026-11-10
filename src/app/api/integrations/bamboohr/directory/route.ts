import { NextResponse } from 'next/server';
import { getDirectory } from '@/lib/integrations/bamboohr.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live BambooHR directory, normalized for roster import. */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId')?.trim() || '';
  if (!companyId) return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  try {
    const employees = await getDirectory(companyId);
    const people = employees
      .map((e) => ({
        firstName: e.firstName || '',
        lastName: e.lastName || '',
        name: e.displayName || `${e.firstName || ''} ${e.lastName || ''}`.trim(),
        email: (e.workEmail || '').trim().toLowerCase(),
        title: e.jobTitle || '',
        department: e.department || '',
      }))
      .filter((p) => p.email && p.name);
    return NextResponse.json({ count: people.length, people });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
