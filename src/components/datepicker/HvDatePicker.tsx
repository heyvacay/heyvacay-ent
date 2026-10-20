'use client';

/**
 * HeyVacay.co's date picker, ported into the enterprise app: a two-month range
 * calendar in a popover (desktop) or full-screen sheet (mobile), with the same
 * tweaks the consumer app carries — the displayed month only moves on arrow nav
 * (never re-anchors when you pick a day), a complete range resets on the next
 * click, disabled days show a reason tooltip, and a Reset / Done footer.
 *
 * Two entry points: HvRangeField (round-trip flights + hotels) and HvDateField
 * (one-way depart). The trigger is styled to match the app's own input fields.
 */

import * as React from 'react';
import type { DateRange, Matcher } from 'react-day-picker';
import { CalendarIcon, Ban, X } from 'lucide-react';
import { addDays, format, startOfMonth } from 'date-fns';

import { Calendar, CalendarDayButton } from './calendar';
import { Button } from './button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { getCurrentDateInTimezone } from './dateUtils';

const CHECKIN_MAX_DAYS = 730; // check-in within 24 months of today

function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return mobile;
}

function useBodyScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

function TriggerBox({
  id,
  value,
  placeholder,
  onOpen,
}: {
  id?: string;
  value: string;
  placeholder: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25"
    >
      <span className={value ? 'truncate text-slate-900' : 'text-slate-400'}>
        {value || placeholder}
      </span>
      <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

/** The popover (desktop) / full-screen sheet (mobile) that holds a calendar. */
function PickerShell({
  open,
  setOpen,
  isMobile,
  trigger,
  children,
  onReset,
  onDone,
  doneDisabled,
  popoverSide = 'bottom',
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  isMobile: boolean;
  trigger: React.ReactNode;
  children: React.ReactNode;
  onReset: () => void;
  onDone: () => void;
  doneDisabled: boolean;
  popoverSide?: 'top' | 'bottom';
}) {
  useBodyScrollLock(open && isMobile);

  const Footer = (
    <div className="flex justify-between gap-2 border-t border-slate-200 p-3">
      <Button onClick={onReset} size="sm" variant="ghost">
        Reset
      </Button>
      <Button onClick={onDone} size="sm" disabled={doneDisabled}>
        Done
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <div>
        {trigger}
        {open && (
          <div className="fixed inset-0 z-[100] flex max-h-screen flex-col bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-base font-semibold text-slate-900">
                Select dates
              </div>
              <button
                aria-label="Close"
                className="rounded-md p-2 hover:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="relative min-h-0 flex-1 overflow-auto"
              style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
            >
              <div className="p-2">{children}</div>
            </div>
            {Footer}
          </div>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <PopoverTrigger asChild>
          <div className="relative">{trigger}</div>
        </PopoverTrigger>
      </PopoverAnchor>
      <PopoverContent
        className="w-auto overflow-hidden p-0"
        align="start"
        side={popoverSide}
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col">
          <div className="p-2">{children}</div>
          {Footer}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------ range ------------------------------ */

function formatRangeLabel(range?: DateRange) {
  if (!range?.from) return '';
  const fromLabel = format(range.from, 'EEE, MMM d');
  if (!range.to) return fromLabel;
  return `${fromLabel} – ${format(range.to, 'EEE, MMM d')}`;
}

export function HvRangeField({
  id,
  value,
  onChange,
  placeholder = 'Select dates',
  maxRangeDays,
  timezone,
  popoverSide = 'bottom',
}: {
  id?: string;
  value?: DateRange;
  onChange: (val: DateRange | undefined) => void;
  placeholder?: string;
  /** Cap the stay length (e.g. 30 for hotels). Omit for no cap (flights). */
  maxRangeDays?: number;
  timezone?: string;
  popoverSide?: 'top' | 'bottom';
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<DateRange | undefined>(value);

  React.useEffect(() => setRange(value), [value]);

  const minSelectable = React.useMemo(
    () => getCurrentDateInTimezone(timezone),
    [timezone]
  );
  const maxSelectable = React.useMemo(
    () => addDays(getCurrentDateInTimezone(timezone), CHECKIN_MAX_DAYS),
    [timezone]
  );

  // Displayed month re-seeds only when (re)opened — never on day selection.
  const [month, setMonth] = React.useState<Date>(
    () => value?.from ?? getCurrentDateInTimezone(timezone)
  );
  React.useEffect(() => {
    if (open) setMonth(range?.from ?? minSelectable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Propagate on close (outside click) when the range is complete or cleared.
  const prevOpen = React.useRef(open);
  React.useEffect(() => {
    if (prevOpen.current && !open) {
      const complete = range?.from && range?.to;
      const empty = !range || !range.from;
      if (complete || empty) onChange(range);
    }
    prevOpen.current = open;
  }, [open, range, onChange]);

  const disabledDays = React.useMemo<Matcher[]>(() => {
    const matchers: Matcher[] = [
      { before: minSelectable },
      { after: maxSelectable },
    ];
    if (maxRangeDays && range?.from && !range?.to) {
      matchers.push({ after: addDays(range.from, maxRangeDays) });
    }
    return matchers;
  }, [minSelectable, maxSelectable, maxRangeDays, range?.from, range?.to]);

  const rangeRef = React.useRef(range);
  rangeRef.current = range;
  const DayButtonWithTooltip = React.useMemo(() => {
    const Comp = (props: React.ComponentProps<typeof CalendarDayButton>) => {
      const { date } = props.day;
      const { current } = rangeRef;
      const outOfWindow = date < minSelectable || date > maxSelectable;
      const beyondCap =
        !!maxRangeDays &&
        !!current?.from &&
        !current?.to &&
        date > addDays(current.from, maxRangeDays);
      let reason: string | null = null;
      if (outOfWindow) reason = 'Outside booking window';
      else if (beyondCap) reason = `Stays are limited to ${maxRangeDays} days`;
      if (!reason) return <CalendarDayButton {...props} />;
      return (
        <span className="group relative inline-flex items-center justify-center">
          <CalendarDayButton {...props} />
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md group-hover:flex"
          >
            <Ban className="h-3 w-3" />
            {reason}
          </span>
        </span>
      );
    };
    Comp.displayName = 'DayButtonWithTooltip';
    return Comp;
  }, [minSelectable, maxSelectable, maxRangeDays]);

  // A click on an already-complete range starts a fresh check-in.
  const handleSelect = React.useCallback(
    (next: DateRange | undefined, triggerDate: Date) => {
      setRange((current) =>
        current?.from && current?.to
          ? { from: triggerDate, to: undefined }
          : next
      );
    },
    []
  );

  const calendar = (
    <Calendar
      mode="range"
      min={1}
      captionLayout="dropdown"
      showOutsideDays={false}
      numberOfMonths={2}
      selected={range}
      onSelect={handleSelect}
      month={month}
      onMonthChange={setMonth}
      startMonth={startOfMonth(minSelectable)}
      endMonth={maxSelectable}
      disabled={disabledDays}
      excludeDisabled
      components={{ DayButton: DayButtonWithTooltip }}
    />
  );

  return (
    <PickerShell
      open={open}
      setOpen={setOpen}
      isMobile={isMobile}
      popoverSide={popoverSide}
      onReset={() => setRange(undefined)}
      onDone={() => {
        onChange(range);
        setOpen(false);
      }}
      doneDisabled={!range?.from || !range?.to}
      trigger={
        <TriggerBox
          id={id}
          value={formatRangeLabel(range ?? value)}
          placeholder={placeholder}
          onOpen={() => setOpen(true)}
        />
      }
    >
      {calendar}
    </PickerShell>
  );
}

/* ------------------------------ single ------------------------------ */

export function HvDateField({
  id,
  value,
  onChange,
  placeholder = 'Select date',
  timezone,
  popoverSide = 'bottom',
}: {
  id?: string;
  value?: Date;
  onChange: (val: Date | undefined) => void;
  placeholder?: string;
  timezone?: string;
  popoverSide?: 'top' | 'bottom';
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(value);

  React.useEffect(() => setDate(value), [value]);

  const minSelectable = React.useMemo(
    () => getCurrentDateInTimezone(timezone),
    [timezone]
  );
  const maxSelectable = React.useMemo(
    () => addDays(getCurrentDateInTimezone(timezone), CHECKIN_MAX_DAYS),
    [timezone]
  );

  const [month, setMonth] = React.useState<Date>(
    () => value ?? getCurrentDateInTimezone(timezone)
  );
  React.useEffect(() => {
    if (open) setMonth(date ?? minSelectable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const disabledDays = React.useMemo<Matcher[]>(
    () => [{ before: minSelectable }, { after: maxSelectable }],
    [minSelectable, maxSelectable]
  );

  const calendar = (
    <Calendar
      mode="single"
      captionLayout="dropdown"
      showOutsideDays={false}
      numberOfMonths={2}
      selected={date}
      onSelect={(d) => setDate(d)}
      month={month}
      onMonthChange={setMonth}
      startMonth={startOfMonth(minSelectable)}
      endMonth={maxSelectable}
      disabled={disabledDays}
    />
  );

  return (
    <PickerShell
      open={open}
      setOpen={setOpen}
      isMobile={isMobile}
      popoverSide={popoverSide}
      onReset={() => setDate(undefined)}
      onDone={() => {
        onChange(date);
        setOpen(false);
      }}
      doneDisabled={!date}
      trigger={
        <TriggerBox
          id={id}
          value={date ? format(date, 'EEE, MMM d') : ''}
          placeholder={placeholder}
          onOpen={() => setOpen(true)}
        />
      }
    >
      {calendar}
    </PickerShell>
  );
}
