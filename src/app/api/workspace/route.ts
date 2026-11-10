import { NextResponse } from 'next/server';
import { loadWorkspace, saveWorkspace } from '@/lib/workspaceStore.server';
import type { AppState } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Per-company workspace sync.
 *   GET  /api/workspace?companyId=... → the shared workspace (or null)
 *   POST /api/workspace { companyId, state, role } → persist it (normalized)
 * Powers multi-device sync: every device that signs into a company loads and
 * writes the same server-side workspace instead of per-browser localStorage.
 */
export async function GET(req: Request) {
  const companyId = new URL(req.url).searchParams.get('companyId') || '';
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
  }
  try {
    const data = await loadWorkspace(companyId);
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ data: null });
  }
}

export async function POST(req: Request) {
  let body: { companyId?: string; state?: AppState; role?: 'admin' | 'booker' | 'employee' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '');
  if (!companyId || !body.state) {
    return NextResponse.json({ error: 'companyId and state are required.' }, { status: 400 });
  }
  try {
    await saveWorkspace(companyId, { state: body.state, role: body.role || 'admin' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message || 'Save failed.' },
      { status: 500 }
    );
  }
}
