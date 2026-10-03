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

export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function dateRange(a: string, b: string): string {
  const d1 = new Date(a);
  const d2 = new Date(b);
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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}
