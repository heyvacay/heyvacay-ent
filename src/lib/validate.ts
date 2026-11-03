/**
 * Shared input validation + formatting helpers (work-email gate, US phone
 * formatting, name assembly). Used across signup, booking and CRM.
 */

/** Common consumer / free mailbox providers — not allowed for work signup. */
export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'pm.me',
  'hey.com',
]);

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** A work email: well-formed AND not a known free/consumer domain. */
export function isWorkEmail(email: string): boolean {
  return isValidEmail(email) && !FREE_EMAIL_DOMAINS.has(emailDomain(email));
}

/** Validate a work email and return a human reason when it fails (else null). */
export function workEmailError(email: string): string | null {
  const e = email.trim();
  if (!e) return null; // don't nag on empty
  if (!isValidEmail(e)) return 'Enter a valid email address.';
  if (FREE_EMAIL_DOMAINS.has(emailDomain(e)))
    return 'Please use your work email — personal addresses (Gmail, Yahoo, etc.) aren’t allowed.';
  return null;
}

/**
 * Progressive US phone formatter: (555) 123-4567, extending as digits arrive.
 * Keeps a leading +1 if present. Non-digits are ignored.
 */
export function formatUSPhone(input: string): string {
  const raw = input.replace(/[^\d]/g, '');
  let d = raw;
  let prefix = '';
  if (d.startsWith('1') && d.length > 10) {
    prefix = '+1 ';
    d = d.slice(1);
  }
  d = d.slice(0, 10);
  if (d.length === 0) return prefix.trim();
  if (d.length < 4) return `${prefix}(${d}`;
  if (d.length < 7) return `${prefix}(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `${prefix}(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** The E.164-ish value for a US number, for sending to APIs. */
export function usPhoneE164(input: string): string {
  const d = input.replace(/[^\d]/g, '');
  if (!d) return '';
  return d.startsWith('1') ? `+${d}` : `+1${d}`;
}

export interface NameParts {
  firstName: string;
  lastName: string;
  middleName?: string;
}

/** Join first / middle / last into a display name, skipping blanks. */
export function fullName(p: NameParts): string {
  return [p.firstName, p.middleName, p.lastName]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
