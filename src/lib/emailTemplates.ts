/**
 * Transactional email templates (server-safe, pure functions).
 *
 * Each returns { subject, html, text }. Rendered by /api/email/send, which
 * delivers them through the configured provider (EMAIL_API_KEY) or returns a
 * preview when no key is set. Branded to match the HeyVacay look.
 */

const NAVY = '#0a1426';
const BRAND = '#23e3ef';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:${NAVY};border-radius:16px 16px 0 0;padding:20px 24px">
      <span style="color:${BRAND};font-weight:800;letter-spacing:.14em;font-size:12px">HEYVACAY ENTERPRISE</span>
    </div>
    <div style="background:#fff;border-radius:0 0 16px 16px;padding:24px;border:1px solid #e2e8f0;border-top:0">
      <h1 style="margin:0 0 12px;font-size:20px;color:${NAVY}">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">
      HeyVacay, Inc. · Corporate travel &amp; expense, 100% free.
    </p>
  </div></body></html>`;
}

function kv(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;background:#f8fafc;border-radius:12px">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:8px 14px;color:#64748b;font-size:14px">${k}</td><td style="padding:8px 14px;text-align:right;font-weight:600;font-size:14px">${v}</td></tr>`
      )
      .join('')}
  </table>`;
}

export interface TripEmailData {
  travelerName: string;
  title: string;
  roomType?: string;
  dates: string;
  total: number;
  savings: number;
  points: number;
  inPolicy: boolean;
}

export function confirmationEmail(d: TripEmailData): { subject: string; html: string; text: string } {
  const body = `
    <p style="font-size:15px;color:#334155">Hi ${d.travelerName}, your trip is confirmed — have a great time!</p>
    <div style="font-weight:700;font-size:16px;color:${NAVY};margin-top:8px">${d.title}</div>
    ${d.roomType ? `<div style="color:#64748b;font-size:14px">${d.roomType}</div>` : ''}
    ${kv([
      ['Dates', d.dates],
      ['Total', money(d.total)],
      ['Saved your company', money(d.savings)],
      ['Points earned', `+${d.points}`],
      ['Policy', d.inPolicy ? 'In policy ✓' : 'Policy note acknowledged'],
    ])}
    <p style="font-size:13px;color:#94a3b8">A copy of this itinerary is in your HeyVacay trips.</p>`;
  return {
    subject: `Your trip is confirmed — ${d.title}`,
    html: wrap('Booking confirmed 🎉', body),
    text: `Your trip is confirmed: ${d.title}, ${d.dates}. Total ${money(d.total)}, saved ${money(
      d.savings
    )}, +${d.points} pts.`,
  };
}

export function approvalPendingEmail(d: TripEmailData & { manager: string; note?: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const body = `
    <p style="font-size:15px;color:#334155">Hi ${d.manager}, ${d.travelerName} submitted a trip that needs your approval.</p>
    <div style="font-weight:700;font-size:16px;color:${NAVY};margin-top:8px">${d.title}</div>
    ${d.roomType ? `<div style="color:#64748b;font-size:14px">${d.roomType}</div>` : ''}
    ${kv([
      ['Traveler', d.travelerName],
      ['Dates', d.dates],
      ['Total', money(d.total)],
      ['Saves the company', money(d.savings)],
    ])}
    ${d.note ? `<p style="font-size:14px;color:#334155"><strong>Their note:</strong> ${d.note}</p>` : ''}
    <a href="#" style="display:inline-block;margin-top:8px;background:${BRAND};color:${NAVY};font-weight:700;text-decoration:none;padding:10px 18px;border-radius:10px">Review &amp; decide</a>`;
  return {
    subject: `Approval needed — ${d.travelerName}: ${d.title}`,
    html: wrap('A trip needs your approval', body),
    text: `${d.travelerName} needs approval for ${d.title} (${d.dates}), total ${money(d.total)}.`,
  };
}

export function approvalDecidedEmail(d: {
  travelerName: string;
  title: string;
  approved: boolean;
  note?: string;
}): { subject: string; html: string; text: string } {
  const body = `
    <p style="font-size:15px;color:#334155">Hi ${d.travelerName}, your trip <strong>${d.title}</strong> was ${
      d.approved ? 'approved' : 'declined'
    }.</p>
    ${d.note ? `<p style="font-size:14px;color:#334155"><strong>Note from your manager:</strong> ${d.note}</p>` : ''}
    <p style="font-size:14px;color:#64748b">${
      d.approved ? "You're all set — see your trips for details." : 'Reach out to your manager if you have questions.'
    }</p>`;
  return {
    subject: `${d.approved ? 'Approved' : 'Declined'} — ${d.title}`,
    html: wrap(d.approved ? 'Your trip was approved ✓' : 'Your trip was declined', body),
    text: `Your trip ${d.title} was ${d.approved ? 'approved' : 'declined'}.`,
  };
}

export const TEMPLATES = {
  confirmation: confirmationEmail,
  approvalPending: approvalPendingEmail,
  approvalDecided: approvalDecidedEmail,
} as const;

export type TemplateName = keyof typeof TEMPLATES;
