export function money(n: number, currency = 'USD'): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
}

export function money2(n: number, currency = 'USD'): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function num(n: number): string {
  return n.toLocaleString('en-US');
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/**
 * Parse a date string as LOCAL time. A bare YYYY-MM-DD is otherwise parsed as
 * UTC midnight, which renders as the previous day in US timezones — the cause
 * of bookings showing a day early.
 */
export function parseLocal(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(iso);
}

export function shortDate(iso: string): string {
  const d = parseLocal(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function dateRange(a: string, b: string): string {
  const d1 = parseLocal(a);
  const d2 = parseLocal(b);
  const sameYear = d1.getFullYear() === d2.getFullYear();
  const f = (d: Date, withYear: boolean) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  return `${f(d1, !sameYear)} – ${f(d2, true)}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO(): string {
  // Local calendar date (not UTC) so "today" is correct across timezones.
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseLocal(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysUntil(iso: string): number {
  const d = parseLocal(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
