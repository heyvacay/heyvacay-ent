import { cn } from './ui';

/**
 * The HeyVacay wordmark (same asset as heyvacay.co) with a blue label lockup
 * underneath. tone="auto" inverts the dark ink only in app dark mode; tone="light"
 * always renders it white (for permanently-dark surfaces like the Nova sidebar).
 */
export function Logo({
  sub = true,
  label = 'Enterprise',
  tone = 'auto',
  className,
  imgClassName = 'h-6',
}: {
  sub?: boolean;
  label?: string;
  tone?: 'auto' | 'light';
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={cn('inline-flex flex-col items-start leading-none', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/svg/heyvacay-logo.svg"
        alt="HeyVacay"
        className={cn(tone === 'light' ? 'hv-logo-light' : 'hv-logo', 'w-auto', imgClassName)}
      />
      {sub && (
        <span
          className={cn(
            'mt-1 text-[11px] font-extrabold uppercase tracking-[0.2em]',
            tone === 'light' ? 'text-brand' : 'text-brand-dark'
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
