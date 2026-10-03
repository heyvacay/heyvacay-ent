import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = '',
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-sm',
        pad && 'p-5 sm:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? 'ring-1 ring-brand/30' : ''}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          'mt-2 font-display text-3xl font-extrabold tracking-tight',
          accent ? 'text-brand-dark' : 'text-slate-900'
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-sm text-slate-500">{sub}</p>}
    </Card>
  );
}

type BadgeColor = 'green' | 'amber' | 'slate' | 'brand' | 'red';
const BADGE: Record<BadgeColor, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15',
  brand: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
};

export function Badge({
  color = 'slate',
  children,
}: {
  color?: BadgeColor;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        BADGE[color]
      )}
    >
      {children}
    </span>
  );
}

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  href?: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  type = 'button',
  onClick,
  disabled,
  className = '',
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
  }[size];
  const variants = {
    primary: 'bg-brand text-navy-deep hover:brightness-95 shadow-sm',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  }[variant];
  const cls = cn(base, sizes, variants, className);

  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function ProgressBar({
  value,
  max,
  tone = 'brand',
}: {
  value: number;
  max: number;
  tone?: 'brand' | 'amber' | 'red';
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const bar = { brand: 'bg-brand', amber: 'bg-amber-400', red: 'bg-red-400' }[
    tone
  ];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const CONTROL =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 placeholder:text-slate-400';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(CONTROL, 'pr-8', props.className)} />;
}

export function Avatar({ name }: { name: string }) {
  const init = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
      {init}
    </span>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
      <p className="font-semibold text-slate-600">{title}</p>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
    </div>
  );
}
