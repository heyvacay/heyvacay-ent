'use client';

import { useState } from 'react';
import { Button, Card, cn } from '@/components/app/ui';
import { money } from '@/lib/format';
import { Check, Users } from '@/components/icons';
import { HotelCarousel } from './HotelCarousel';
import {
  defaultSelection,
  firstEnabledMeal,
  firstEnabledRefund,
  resolveLeaf,
  sumPayAtProperty,
  toTitleCase,
  type RoomSelection,
  type UiRoom,
} from '@/lib/hotelRooms';

export interface ReserveArgs {
  roomTitle: string;
  bookHash: string;
  price: number; // all-in total
  perNight: number;
  competitive?: number; // all-in strikethrough
  bed: string;
  refund: string;
  meal: string;
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
      {right && !disabled && (
        <span className="ms-auto text-slate-400">{right}</span>
      )}
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

export function RoomCard({
  room,
  onReserve,
  onPhotos,
}: {
  room: UiRoom;
  onReserve: (args: ReserveArgs) => void;
  onPhotos: (images: string[], title: string) => void;
}) {
  const [sel, setSel] = useState<RoomSelection | null>(() => defaultSelection(room));
  const leaf = resolveLeaf(room, sel);

  const changeBed = (bedKey: string) => {
    const bed = room.bedOptions.find((b) => b.bedKey === bedKey);
    if (!bed) return;
    const refund = firstEnabledRefund(bed);
    const meal = refund ? firstEnabledMeal(refund) : undefined;
    setSel({
      bedKey,
      refundKey: refund?.refundKey ?? '',
      mealCode: meal?.mealCode ?? '',
    });
  };
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
  const currency = rate?.currency ?? room.from.currency ?? 'USD';
  const perNight = rate?.pricePerDay ?? rate?.price ?? 0;
  const competitive = rate?.competitivePrice ?? room.from.competitivePrice;
  const pap = sumPayAtProperty(rate?.taxes_fees);
  const allIn = Math.ceil(Number(price || 0) + pap);
  const allInComp =
    competitive != null ? Math.ceil(Number(competitive) + pap) : undefined;
  const showStrike = allInComp != null && allInComp > allIn;
  const totalCaption = pap > 0 ? 'Total incl. taxes & resort fees' : 'Total with taxes & fees';

  const bed = leaf?.bed;
  const refundOpts = bed?.refundOptions ?? [];
  const refund = leaf?.refund;
  const meals = refund?.mealOptions ?? [];
  const hideMeals = meals.length <= 1 && meals[0]?.mealCode === 'nomeal';

  return (
    <Card pad={false} className="flex h-full flex-col overflow-hidden">
      <HotelCarousel
        images={room.images}
        alt={room.roomTitle}
        className="h-44 w-full"
      />

      <div className="flex flex-1 flex-col p-3">
        <div className="flex-1">
          <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-slate-900">
            {toTitleCase(room.roomTitle)}
          </h3>

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
                onClick={() => onPhotos(room.images, room.roomTitle)}
                className="font-medium text-brand-dark hover:underline"
              >
                Photos
              </button>
            )}
          </div>

          {/* Bed type */}
          <Section title="Bed type">
            {room.bedOptions.map((b) => (
              <RadioRow
                key={b.bedKey}
                selected={sel?.bedKey === b.bedKey}
                disabled={b.isDisabled}
                label={b.bedLabel ?? b.bedKey}
                right={`+${money(b.priceDelta ?? 0)}`}
                onClick={() => changeBed(b.bedKey)}
              />
            ))}
          </Section>

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
                bed: bed?.bedLabel ?? '',
                refund: refund?.label ?? '',
                meal: leaf?.meal.label ?? '',
              })
            }
          >
            Reserve
          </Button>
        </div>
      </div>
    </Card>
  );
}
