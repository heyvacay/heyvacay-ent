'use client';

import { useState } from 'react';
import { Button, Card, cn } from '@/components/app/ui';
import { money, num } from '@/lib/format';
import { rewardsFor } from '@/lib/rewards';
import { Check, Users, Shield, Gift } from '@/components/icons';
import { HotelCarousel } from './HotelCarousel';
import {
  defaultSelection,
  firstEnabledMeal,
  resolveLeaf,
  sumPayAtProperty,
  toTitleCase,
  type RoomSelection,
  type UiRoom,
} from '@/lib/hotelRooms';

export type PolicyStatus = 'in' | 'note' | 'approval' | 'block';

export interface ReserveArgs {
  roomTitle: string;
  bookHash: string;
  price: number; // all-in total
  perNight: number;
  competitive?: number; // all-in strikethrough
  refund: string;
  meal: string;
  policy: PolicyStatus;
  policyNotes: string[];
  points: number;
  /** Live-booking payload inputs — the untouched supplier rate + room descriptor
   *  needed to build a real prebook. Undefined on display-only rates. */
  rateRaw?: Record<string, unknown>;
  roomCapacity?: number;
  roomImages?: string[];
  roomAmenities?: string[];
  currency?: string;
}

function fmtFreeUntil(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RadioRow({
  selected,
  disabled,
  label,
  right,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  label: string;
  right?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 text-left text-xs',
        disabled ? 'cursor-not-allowed text-slate-300' : 'text-slate-700'
      )}
    >
      <span
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
          selected ? 'border-brand' : 'border-slate-300'
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-brand" />}
      </span>
      <span className={cn(disabled && 'opacity-50', 'text-slate-600')}>{label}</span>
      {right && !disabled && <span className="ms-auto text-slate-400">{right}</span>}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-3 text-sm font-medium text-slate-800">{title}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

const POLICY_META: Record<
  PolicyStatus,
  { label: string; cls: string; Icon: typeof Check }
> = {
  in: { label: 'In policy', cls: 'bg-sky-50 text-sky-700', Icon: Check },
  note: { label: 'Policy note', cls: 'bg-lime-50 text-lime-700', Icon: Shield },
  approval: { label: 'Needs approval', cls: 'bg-amber-50 text-amber-700', Icon: Shield },
  block: { label: 'Out of policy', cls: 'bg-red-50 text-red-700', Icon: Shield },
};

export function RoomCard({
  room,
  onReserve,
  onPhotos,
  assessPolicy,
}: {
  room: UiRoom;
  onReserve: (args: ReserveArgs) => void;
  onPhotos: (images: string[], title: string, index: number) => void;
  assessPolicy?: (priceAllIn: number) => { status: PolicyStatus; notes: string[] };
}) {
  // Bed selection stays internal (defaults to the best bed) — we no longer show
  // confusing bed-type options; travelers choose refundability and meal plan.
  const [sel, setSel] = useState<RoomSelection | null>(() => defaultSelection(room));
  const leaf = resolveLeaf(room, sel);

  const changeRefund = (refundKey: string) => {
    if (!sel) return;
    const bed = room.bedOptions.find((b) => b.bedKey === sel.bedKey);
    const refund = bed?.refundOptions.find((r) => r.refundKey === refundKey);
    const meal = refund ? firstEnabledMeal(refund) : undefined;
    setSel({ ...sel, refundKey, mealCode: meal?.mealCode ?? '' });
  };
  const changeMeal = (mealCode: string) => {
    if (!sel) return;
    setSel({ ...sel, mealCode });
  };

  const rate = leaf?.meal.rateRef;
  const price = rate?.price ?? room.from.amount ?? 0;
  const perNight = rate?.pricePerDay ?? rate?.price ?? 0;
  const competitive = rate?.competitivePrice ?? room.from.competitivePrice;
  const pap = sumPayAtProperty(rate?.taxes_fees);
  const allIn = Math.ceil(Number(price || 0) + pap);
  const allInComp =
    competitive != null ? Math.ceil(Number(competitive) + pap) : undefined;
  const showStrike = allInComp != null && allInComp > allIn;
  const totalCaption = pap > 0 ? 'Total incl. taxes & resort fees' : 'Total with taxes & fees';

  // Points reward savings on THIS room (more saved vs market = more points),
  // so cheaper rooms earn more — per-room, not per-spend.
  const points = rewardsFor({
    type: 'hotel',
    marketPrice: allInComp ?? allIn,
    price: allIn,
  }).points;

  const assessment = assessPolicy?.(allIn);
  const policy: PolicyStatus = assessment?.status ?? 'in';
  const policyNotes = assessment?.notes ?? [];
  const pm = POLICY_META[policy];

  const refundOpts = leaf?.bed?.refundOptions ?? [];
  const refund = leaf?.refund;
  const meals = refund?.mealOptions ?? [];
  const hideMeals = meals.length <= 1 && meals[0]?.mealCode === 'nomeal';

  const openPhotos = (index = 0) => onPhotos(room.images, room.roomTitle, index);

  return (
    <Card
      pad={false}
      className={cn(
        'flex h-full flex-col overflow-hidden ring-1',
        policy === 'block'
          ? 'ring-red-200'
          : policy === 'approval'
            ? 'ring-amber-200'
            : policy === 'note'
              ? 'ring-lime-200'
              : 'ring-transparent'
      )}
    >
      <HotelCarousel
        images={room.images}
        alt={room.roomTitle}
        className="h-44 w-full"
        onImageClick={(i) => openPhotos(i)}
      />

      <div className="flex flex-1 flex-col p-3">
        <div className="flex-1">
          <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-slate-900">
            {toTitleCase(room.roomTitle)}
          </h3>

          {/* policy + points chips */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', pm.cls)}>
              <pm.Icon className="h-3 w-3" /> {pm.label}
            </span>
            {points > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand-dark">
                <Gift className="h-3 w-3" /> +{num(points)} pts
              </span>
            )}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Sleeps {room.capacity}
            </span>
            {room.amenities.slice(0, 3).map((a) => (
              <span key={a} className="inline-flex items-center gap-1">
                <Check className="h-3 w-3 text-brand-dark" /> {a}
              </span>
            ))}
            {room.images.length > 0 && (
              <button
                type="button"
                onClick={() => openPhotos(0)}
                className="font-medium text-brand-dark hover:underline"
              >
                Photos
              </button>
            )}
          </div>

          {/* Refundability */}
          {sel && refundOpts.length > 0 && (
            <Section title="Refundability">
              {refundOpts.map((r) => {
                const freeUntil = r.cancellation?.free_until;
                const label =
                  freeUntil && freeUntil.length > 0
                    ? `Fully refundable before ${fmtFreeUntil(freeUntil)}`
                    : r.label;
                return (
                  <RadioRow
                    key={r.refundKey}
                    selected={sel.refundKey === r.refundKey}
                    disabled={r.isDisabled}
                    label={label}
                    right={`+${money(r.priceDelta ?? 0)}`}
                    onClick={() => changeRefund(r.refundKey)}
                  />
                );
              })}
            </Section>
          )}

          {/* Meal plan */}
          {sel && !hideMeals && meals.length > 0 && (
            <Section title="Meal plan">
              {meals.map((m) => {
                const disabled = m.isDisabled || !m.rateRef;
                return (
                  <RadioRow
                    key={m.mealCode}
                    selected={sel.mealCode === m.mealCode}
                    disabled={disabled}
                    label={m.label}
                    right={`+${money(m.priceDelta ?? 0)}`}
                    onClick={() => !disabled && changeMeal(m.mealCode)}
                  />
                );
              })}
            </Section>
          )}
        </div>

        {/* Pricing + reserve */}
        <div className="mt-2">
          <div className="flex flex-col text-right">
            <p className="mt-1 text-xs text-slate-400">
              {money(Math.ceil(Number(perNight) || 0))} /night
            </p>
            <div className="flex items-center justify-end gap-2">
              {showStrike && (
                <span className="text-xs text-slate-400 line-through">
                  {money(allInComp!)}
                </span>
              )}
              <span className="text-sm font-bold text-slate-900">{money(allIn)}</span>
            </div>
            <span className="text-xs text-slate-400">{totalCaption}</span>
          </div>
          <Button
            className="mt-4 w-full"
            disabled={!rate}
            onClick={() =>
              rate &&
              onReserve({
                roomTitle: room.roomTitle,
                bookHash: rate.book_hash,
                price: allIn,
                perNight: Math.ceil(Number(perNight) || 0),
                competitive: showStrike ? allInComp : undefined,
                refund: refund?.label ?? '',
                meal: leaf?.meal.label ?? '',
                policy,
                policyNotes,
                points,
                rateRaw: rate.raw,
                roomCapacity: room.capacity,
                roomImages: room.images,
                roomAmenities: room.amenities,
                currency: rate.currency,
              })
            }
          >
            {policy === 'block'
              ? 'Request override'
              : policy === 'approval'
                ? 'Request approval'
                : 'Reserve'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
