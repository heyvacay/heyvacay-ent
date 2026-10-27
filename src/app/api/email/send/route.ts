import { NextResponse } from 'next/server';
import { EMAIL } from '@/lib/config.server';
import { TEMPLATES, type TemplateName } from '@/lib/emailTemplates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Render + send a transactional email. Delivers through the configured provider
 * when EMAIL_API_KEY is set (default endpoint is Resend-compatible — change
 * EMAIL_API_BASE for another provider), otherwise returns a preview so flows
 * work end-to-end in the demo without sending anything.
 */
export async function POST(req: Request) {
  let body: { template?: string; to?: string; data?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const name = body.template as TemplateName;
  const fn = name && TEMPLATES[name];
  if (!fn || !body.to) {
    return NextResponse.json({ error: 'template and to are required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { subject, html, text } = (fn as any)(body.data ?? {});

  if (EMAIL.live) {
    try {
      const base = process.env.EMAIL_API_BASE || 'https://api.resend.com';
      // Match the consumer sender identity: a friendly "HeyVacay" display name
      // unless the configured address already carries one.
      const from = EMAIL.from.includes('<') ? EMAIL.from : `HeyVacay <${EMAIL.from}>`;
      const res = await fetch(`${base}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${EMAIL.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: body.to, subject, html, text }),
        cache: 'no-store',
      });
      if (res.ok) return NextResponse.json({ sent: true, source: 'provider' });
      // fall through to preview on provider error
    } catch {
      /* fall through */
    }
  }

  return NextResponse.json({ sent: false, preview: { to: body.to, subject }, source: EMAIL.live ? 'provider_fallback' : 'preview' });
}
