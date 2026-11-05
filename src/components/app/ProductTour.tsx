'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Button } from './ui';

export interface TourStep {
  /** CSS selector for the element to spotlight (e.g. a nav link). */
  selector: string;
  title: string;
  body: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * A guided product tour: dims the screen, spotlights one target element at a
 * time and shows a tooltip explaining it, with Back / Next / Skip. Targets are
 * matched by CSS selector (we tag nav links with data-tour). If a target isn't
 * found, the step is shown centered so the tour never dead-ends.
 */
export function ProductTour({
  steps,
  onFinish,
  onSkip,
}: {
  steps: TourStep[];
  onFinish: () => void;
  onSkip: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    measure();
    const t = setTimeout(measure, 320); // after scroll settles
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  // Advance / retreat with the keyboard too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      else if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, steps.length]);

  const last = i === steps.length - 1;
  const next = () => (last ? onFinish() : setI((n) => n + 1));

  if (!step) return null;

  const pad = 6;
  const spot: Rect | null = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Tooltip placement: to the right of the target when there's room (sidebar
  // nav), otherwise below; centered when there's no target.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  let tipStyle: React.CSSProperties;
  if (spot) {
    const rightRoom = vw - (spot.left + spot.width);
    if (rightRoom > 340) {
      tipStyle = { top: Math.max(16, spot.top), left: spot.left + spot.width + 14 };
    } else {
      tipStyle = { top: spot.top + spot.height + 12, left: Math.max(16, Math.min(spot.left, vw - 340)) };
    }
  } else {
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  }

  return (
    <div className="fixed inset-0 z-[130]">
      {/* Dim with a spotlight hole (big box-shadow), or a plain dim if no target. */}
      {spot ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-brand transition-all duration-300"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: '0 0 0 9999px rgba(8,16,32,0.72)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(8,16,32,0.72)]" />
      )}

      {/* Tooltip card */}
      <div
        className="absolute w-[320px] max-w-[calc(100vw-32px)] rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900"
        style={tipStyle}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark">
            Step {i + 1} of {steps.length}
          </span>
          <button onClick={onSkip} className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Skip tour
          </button>
        </div>
        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{step.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1">
            {steps.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-brand' : 'w-1.5 bg-slate-300 dark:bg-white/20'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setI((n) => Math.max(0, n - 1))}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {last ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
