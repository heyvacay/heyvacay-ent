'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  to: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

function format(n: number, decimals: number) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Counts up from 0 to `to` the first time it scrolls into view. Used for the
 * savings / stat numbers. Reduced-motion users see the final value immediately.
 */
export default function CountUp({
  to,
  durationMs = 1800,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reduce) {
      setValue(to);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const tick = (now: number) => {
              const p = Math.min(1, (now - start) / durationMs);
              // easeOutExpo
              const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
              setValue(to * eased);
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, durationMs]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {format(value, decimals)}
      {suffix}
    </span>
  );
}
