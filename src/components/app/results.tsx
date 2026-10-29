'use client';

import { useState } from 'react';
import { Button, Card, cn } from '@/components/app/ui';
import { money, num } from '@/lib/format';
import { Building, Check, Gift, Plane, Shield } from '@/components/icons';
import type { InventoryOption } from '@/lib/types';
import type { PolicyFlag } from '@/lib/store';

/* ---------------- shared formatting ---------------- */

export function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function durLabel(mins?: number): string {
  if (mins == null) return '';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
export function stopsLabel(stops?: number): string {
  if (!stops || stops <= 0) return 'Direct';
  return stops === 1 ? '1 stop' : `${stops} stops`;
}

export function Stars({ n = 0 }: { n?: number }) {
  return (
    <span className="text-sm leading-none">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? 'text-amber-400' : 'text-slate-200'}>
          ★
        </span>
      ))}
    </span>
  );
}

/** The enterprise overlay every result carries: policy + savings + points. */
export function Signals({
  flags,
  savings,
  points,
}: {
  flags: PolicyFlag[];
  savings: number;
  points: number;
}) {
  const needsApproval = flags.some(
    (f) => f.policy.action === 'approve' || f.policy.action === 'block'
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      {flags.length === 0 ? (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" /> In policy
        </span>
      ) : needsApproval ? (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Shield className="h-3.5 w-3.5" /> Needs approval
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Shield className="h-3.5 w-3.5" /> Policy note
        </span>
      )}
      {savings > 0 && (
        <span className="font-semibold text-emerald-600">Saves company {money(savings)}</span>
      )}
      <span className="inline-flex items-center gap-1 font-semibold text-brand-dark">
        <Gift className="h-3.5 w-3.5" /> +{num(points)} pts
      </span>
    </div>
  );
}

/** Hotel photo with a branded fallback tile if the image can't load. */
export function HotelImage({ src, alt }: { src?: string; alt: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className="relative h-44 w-full bg-gradient-to-br from-slate-200 to-brand/25">
      <span className="absolute inset-0 grid place-items-center text-slate-400">
        <Building className="h-8 w-8" />
      </span>
      {ok && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export function AirlineBadge({ iata, logo }: { iata?: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={iata ?? 'Airline'}
        width={36}
        height={36}
        onError={() => setFailed(true)}
        className="h-9 w-9 shrink-0 rounded-full object-contain"
      />
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand-dark">
      {iata ?? <Plane className="h-4 w-4" />}
    </span>
  );
}

export interface Sig {
  flags: PolicyFlag[];
  savings: number;
  points: number;
}

/* ---------------- result cards (shared by Book + Plan) ---------------- */

/**
 * One flight fare row. Shared by the single-flight booking screen and the
 * plan-a-trip composer, so both read identically. `actionLabel` + `selected`
 * let the plan screen show a "Selected" toggle instead of an instant book.
 */
export function FlightRow({
  opt,
  sig,
  actionLabel = 'Select',
  selected = false,
  onAction,
  onDetails,
}: {
  opt: InventoryOption;
  sig: Sig;
  actionLabel?: string;
  selected?: boolean;
  onAction: () => void;
  onDetails?: () => void;
}) {
  const { flags, savings, points } = sig;
  return (
    <Card className={cn('flex flex-col gap-4', selected && 'border-brand ring-1 ring-brand/40')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 sm:w-44">
          <AirlineBadge iata={opt.airlineIata} logo={opt.airlineLogo} />
          <span className="text-sm font-medium text-slate-800">{opt.airline}</span>
        </div>

        <div className="flex flex-1 items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-semibold text-slate-900">{fmtTime(opt.departAt)}</div>
            <div className="text-xs text-slate-400">{opt.originIata}</div>
          </div>
          <div className="flex flex-1 flex-col items-center">
            <div className="text-xs text-slate-400">{durLabel(opt.durationMins)}</div>
            <div className="my-1 flex w-full items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full border border-slate-400" />
              <span className="h-px flex-1 bg-slate-200" />
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px]',
                  !opt.stops ? 'border-brand text-brand-dark' : 'border-slate-300 text-slate-400'
                )}
              >
                {stopsLabel(opt.stops)}
              </span>
              <span className="h-px flex-1 bg-slate-200" />
              <Plane className="h-3 w-3 rotate-90 text-slate-400" />
            </div>
          </div>
          <div className="text-left">
            <div className="text-lg font-semibold text-slate-900">{fmtTime(opt.arriveAt)}</div>
            <div className="text-xs text-slate-400">{opt.destIata}</div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 sm:w-44">
          <div className="flex items-center gap-2">
            {savings > 0 && (
              <span className="text-sm text-slate-400 line-through">{money(opt.marketPrice)}</span>
            )}
            <span className="text-xl font-bold text-slate-900">{money(opt.price)}</span>
          </div>
          <Button
            size="sm"
            variant={selected ? 'outline' : 'primary'}
            className="mt-1 w-full"
            onClick={onAction}
          >
            {selected ? (
              <>
                <Check className="h-4 w-4" /> Selected
              </>
            ) : (
              actionLabel
            )}
          </Button>
          {onDetails && (
            <button
              type="button"
              onClick={onDetails}
              className="text-xs font-medium text-brand-dark hover:underline"
            >
              View details
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-slate-100 pt-3">
        <Signals flags={flags} savings={savings} points={points} />
      </div>
    </Card>
  );
}

/** One hotel card. Shared by the single-hotel booking screen and plan-a-trip. */
export function HotelCard({
  opt,
  sig,
  actionLabel = 'Reserve',
  selected = false,
  onAction,
  onDetails,
}: {
  opt: InventoryOption;
  sig: Sig;
  actionLabel?: string;
  selected?: boolean;
  onAction: () => void;
  onDetails?: () => void;
}) {
  const { flags, savings, points } = sig;
  const perNight = Math.round(opt.price / (opt.nights || 1));
  return (
    <Card
      pad={false}
      className={cn('flex flex-col overflow-hidden', selected && 'border-brand ring-1 ring-brand/40')}
    >
      <HotelImage src={opt.imageUrl} alt={opt.title} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <Stars n={opt.star} />
          {opt.rating != null && opt.rating > 0 && (
            <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand-dark">
              {opt.rating.toFixed(1)}
            </span>
          )}
        </div>
        <h3 className="line-clamp-1 font-semibold text-slate-900">{opt.title}</h3>
        <p className="line-clamp-1 text-sm text-slate-400">
          {opt.location ? `${opt.location} · ` : ''}
          {opt.detail}
        </p>
        <Signals flags={flags} savings={savings} points={points} />
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <div className="flex items-center gap-2">
              {savings > 0 && (
                <span className="text-sm text-slate-400 line-through">
                  {money(opt.marketPrice)}
                </span>
              )}
              <span className="text-xl font-bold text-slate-900">{money(opt.price)}</span>
            </div>
            <p className="text-xs text-slate-400">{money(perNight)}/night · incl. taxes</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" variant={selected ? 'outline' : 'primary'} onClick={onAction}>
              {selected ? (
                <>
                  <Check className="h-4 w-4" /> Selected
                </>
              ) : (
                actionLabel
              )}
            </Button>
            {onDetails && (
              <button
                type="button"
                onClick={onDetails}
                className="text-xs font-medium text-brand-dark hover:underline"
              >
                View details
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
