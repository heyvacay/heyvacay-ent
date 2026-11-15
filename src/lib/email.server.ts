import 'server-only';

/**
 * Server-side transactional email send. Renders a template and delivers it
 * through the configured provider (EMAIL_API_KEY; Resend-compatible by default),
 * or returns a non-sent preview when no key is set so flows work end-to-end in
 * the demo without actually emailing anyone.
 *
 * This is the single send path — both the public /api/email/send route and the
 * auth routes (verify code, password reset) call it, so there's one place that
 * knows how to talk to the provider.
 */

import { EMAIL } from '@/lib/config.server';
import { TEMPLATES, type TemplateName } from '@/lib/emailTemplates';

export interface SendResult {
  sent: boolean;
  source: 'provider' | 'provider_fallback' | 'preview';
  preview?: { to: string; subject: string };
}

export async function sendTemplateEmail(
  name: TemplateName,
  to: string,
  data: Record<string, unknown>,
): Promise<SendResult> {
  const fn = TEMPLATES[name];
  if (!fn || !to) {
    return { sent: false, source: 'preview', preview: { to, subject: '' } };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { subject, html, text } = (fn as any)(data ?? {});

  if (EMAIL.live) {
    try {
      const base = process.env.EMAIL_API_BASE || 'https://api.resend.com';
      const from = EMAIL.from.includes('<') ? EMAIL.from : `HeyVacay <${EMAIL.from}>`;
      const res = await fetch(`${base}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${EMAIL.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, html, text }),
        cache: 'no-store',
      });
      if (res.ok) return { sent: true, source: 'provider' };
    } catch {
      /* fall through to preview */
    }
    return { sent: false, source: 'provider_fallback', preview: { to, subject } };
  }

  return { sent: false, source: 'preview', preview: { to, subject } };
}
