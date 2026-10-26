'use client';

import type { TemplateName } from './emailTemplates';

/** Fire-and-forget transactional email (never blocks the UI). */
export function sendEmail(template: TemplateName, to: string, data: Record<string, unknown>): void {
  try {
    fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, to, data }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
