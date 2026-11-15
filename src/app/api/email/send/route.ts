import { NextResponse } from 'next/server';
import { TEMPLATES, type TemplateName } from '@/lib/emailTemplates';
import { sendTemplateEmail } from '@/lib/email.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Render + send a transactional email. Delivers through the configured provider
 * when EMAIL_API_KEY is set (Resend-compatible by default — change EMAIL_API_BASE
 * for another provider), otherwise returns a preview so flows work end-to-end in
 * the demo without sending anything. The actual send lives in
 * `@/lib/email.server` so the auth routes share one send path.
 */
export async function POST(req: Request) {
  let body: { template?: string; to?: string; data?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const name = body.template as TemplateName;
  if (!name || !TEMPLATES[name] || !body.to) {
    return NextResponse.json({ error: 'template and to are required' }, { status: 400 });
  }

  const result = await sendTemplateEmail(name, body.to, body.data ?? {});
  return NextResponse.json(result);
}
