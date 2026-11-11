'use client';

import { useState } from 'react';
import { Check } from '@/components/icons';
import { guideFor } from '@/lib/integrations/setupGuides';

/**
 * A clean, numbered "how to connect" guide shown above a credential form, so an
 * admin knows exactly what to do in the other system. Collapsible so it stays
 * out of the way once they've done it. Returns null when there's no guide.
 */
export function SetupGuide({ id, name }: { id: string; name: string }) {
  const guide = guideFor(id);
  const [open, setOpen] = useState(true);
  if (!guide) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-t-2xl px-5 py-4 text-left"
      >
        <div>
          <p className="font-display text-base font-bold text-slate-900">
            How to connect {name}
          </p>
          <p className="text-xs text-slate-400">
            {guide.steps.length} steps{guide.time ? ` · ${guide.time}` : ''}
          </p>
        </div>
        <span className="text-sm font-medium text-brand-dark">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="space-y-5 px-5 pb-5">
          {/* What you'll need */}
          {guide.needs.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                What you&apos;ll need
              </p>
              <ul className="space-y-1">
                {guide.needs.map((n) => (
                  <li key={n} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Numbered steps */}
          <ol className="space-y-4">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/12 text-sm font-bold text-brand-dark">
                  {i + 1}
                </span>
                <div className="pt-0.5">
                  <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {guide.docUrl && (
            <a
              href={guide.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-semibold text-brand-dark hover:underline"
            >
              {guide.docLabel || 'Documentation'} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
