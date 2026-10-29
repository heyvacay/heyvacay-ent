/**
 * Transactional email templates (server-safe, pure functions).
 *
 * Each returns { subject, html, text }. Rendered by /api/email/send, which
 * delivers them through the configured provider (EMAIL_API_KEY) or returns a
 * preview when no key is set. Branded to match the HeyVacay look.
 */

const NAVY = '#0b1b2b';
const BRAND = '#23e3ef';
const INK = '#1b2537';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Email chrome matched to HeyVacay.co: a clean white card on a soft page, the
 * lowercase "heyvacay" wordmark with the brand cyan dot, Inter, and the same
 * footer the consumer site uses. Kept to inline styles + a table so it renders
 * the same in Gmail / Outlook / Apple Mail.
 */
function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#eef2f6;font-family:Inter,-apple-system,Segoe UI,Arial,sans-serif;color:${INK}">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="text-align:center;padding:4px 0 20px">
      <span style="font-size:26px;font-weight:800;letter-spacing:-.02em;color:${NAVY}">heyvacay<span style="color:${BRAND}">.</span></span>
    </div>
    <div style="background:#fff;border-radius:20px;padding:30px;box-shadow:0 1px 3px rgba(15,23,42,.06);border:1px solid #e7edf3">
      <h1 style="margin:0 0 14px;font-size:21px;line-height:1.25;color:${NAVY};font-weight:800">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#8aa0b5;font-size:12px;line-height:1.6;margin-top:20px">
      HeyVacay, Inc. · Corporate travel &amp; expense, 100% free.<br/>
      Questions? <a href="mailto:support@heyvacay.co" style="color:#64748b;text-decoration:underline">support@heyvacay.co</a>
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

export function eventAddedEmail(d: {
  name: string;
  event: string;
  city: string;
  dates: string;
  host: string;
}): { subject: string; html: string; text: string } {
  const body = `
    <p style="font-size:15px;color:#334155">Hi ${d.name}, ${d.host} added you to a company trip.</p>
    <div style="font-weight:700;font-size:16px;color:${NAVY};margin-top:8px">${d.event}</div>
    ${kv([
      ['Where', d.city],
      ['When', d.dates],
    ])}
    <p style="font-size:14px;color:#334155">Open HeyVacay to see the allowed hotels, chat with the group, and RSVP for the dinner.</p>
    <a href="#" style="display:inline-block;margin-top:8px;background:${BRAND};color:${NAVY};font-weight:700;text-decoration:none;padding:10px 18px;border-radius:10px">View the event</a>`;
  return {
    subject: `You're going to ${d.event}`,
    html: wrap('You were added to an event', body),
    text: `${d.host} added you to ${d.event} — ${d.city}, ${d.dates}.`,
  };
}

export function dinnerInviteEmail(d: {
  name: string;
  event: string;
  date: string;
  time: string;
  city: string;
}): { subject: string; html: string; text: string } {
  const body = `
    <p style="font-size:15px;color:#334155">Hi ${d.name}, there's a group dinner being planned for <strong>${d.event}</strong>.</p>
    ${kv([
      ['Date', d.date],
      ['Time', d.time],
      ['City', d.city],
    ])}
    <p style="font-size:14px;color:#334155">Can you make it? Please RSVP in the event so we can get the headcount right.</p>
    <a href="#" style="display:inline-block;margin-top:8px;background:${BRAND};color:${NAVY};font-weight:700;text-decoration:none;padding:10px 18px;border-radius:10px">RSVP now</a>`;
  return {
    subject: `RSVP: group dinner for ${d.event}`,
    html: wrap('You’re invited to dinner', body),
    text: `Group dinner for ${d.event} on ${d.date} at ${d.time}. Please RSVP.`,
  };
}

export function dinnerReminderEmail(d: { name: string; event: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const body = `
    <p style="font-size:15px;color:#334155">Hi ${d.name}, a quick nudge — we still need your RSVP for the <strong>${d.event}</strong> group dinner.</p>
    <a href="#" style="display:inline-block;margin-top:8px;background:${BRAND};color:${NAVY};font-weight:700;text-decoration:none;padding:10px 18px;border-radius:10px">RSVP now</a>`;
  return {
    subject: `Reminder: RSVP for the ${d.event} dinner`,
    html: wrap('Don’t forget to RSVP', body),
    text: `Reminder: please RSVP for the ${d.event} group dinner.`,
  };
}

export function dinnerBookedEmail(d: {
  name: string;
  restaurant: string;
  date: string;
  time: string;
  partySize: number;
  confirmation: string;
}): { subject: string; html: string; text: string } {
  const body = `
    <p style="font-size:15px;color:#334155">Hi ${d.name}, the group dinner is booked — see you there!</p>
    <div style="font-weight:700;font-size:16px;color:${NAVY};margin-top:8px">${d.restaurant}</div>
    ${kv([
      ['Date', d.date],
      ['Time', d.time],
      ['Party', `${d.partySize}`],
      ['Confirmation', d.confirmation],
    ])}`;
  return {
    subject: `Dinner booked — ${d.restaurant}`,
    html: wrap('Your group dinner is set 🍽️', body),
    text: `Dinner booked: ${d.restaurant} on ${d.date} at ${d.time}, party of ${d.partySize}. Confirmation ${d.confirmation}.`,
  };
}

export function net30KycEmail(d: {
  ownerName: string;
  company: string;
  rep: string;
}): { subject: string; html: string; text: string } {
  const body = `
    <p style="font-size:15px;color:#334155">Hi ${d.ownerName}, ${d.rep} is setting up <strong>Net 30 invoicing</strong> for ${d.company}.</p>
    <p style="font-size:14px;color:#334155">Before we can switch on Net 30, we need a quick Know-Your-Customer (KYC) form from the account owner — legal entity name, tax ID, billing contact, and an authorized signer. It takes about two minutes.</p>
    <a href="#" style="display:inline-block;margin-top:8px;background:${BRAND};color:${NAVY};font-weight:700;text-decoration:none;padding:10px 18px;border-radius:10px">Complete the KYC form</a>
    <p style="font-size:13px;color:#64748b;margin-top:12px">Open HeyVacay → Billing & payments to fill it in. Net 30 goes live as soon as it's approved.</p>`;
  return {
    subject: `Action needed: KYC form to enable Net 30 for ${d.company}`,
    html: wrap('Finish setting up Net 30', body),
    text: `${d.rep} started Net 30 setup for ${d.company}. Complete the KYC form in HeyVacay → Billing to enable it.`,
  };
}

export const TEMPLATES = {
  confirmation: confirmationEmail,
  approvalPending: approvalPendingEmail,
  approvalDecided: approvalDecidedEmail,
  eventAdded: eventAddedEmail,
  dinnerInvite: dinnerInviteEmail,
  dinnerReminder: dinnerReminderEmail,
  dinnerBooked: dinnerBookedEmail,
  net30Kyc: net30KycEmail,
} as const;

export type TemplateName = keyof typeof TEMPLATES;
