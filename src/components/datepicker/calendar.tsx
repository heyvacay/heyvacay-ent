'use client';

import * as React from 'react';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { DayButton, DayPicker, getDefaultClassNames } from 'react-day-picker';
import { cn } from './cn';
import { Button, buttonVariants } from './button';

/** yyyy-based numeric label, used as a stable data attribute per day. */
function numericDay(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Base calendar — HeyVacay.co's two-month range calendar (react-day-picker v9).
 * Design tokens from the consumer app are resolved to concrete colors so it
 * renders identically here: brand cyan #23e3ef for check-in/out, #b9fbff for
 * in-between nights, slate greys for chrome.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  navLayout = 'around',
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout={navLayout}
      className={cn(
        'bg-white group/calendar [--cell-size:--spacing(8)]',
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString('default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn(
          'mx-auto w-full max-w-[22rem] md:mx-0 md:w-fit md:max-w-none',
          defaultClassNames.root
        ),
        months: cn(
          'flex flex-col gap-4 md:flex-row md:gap-6 relative',
          '[&>.rdp-month+.rdp-month]:border-t [&>.rdp-month+.rdp-month]:border-slate-200',
          'md:[&>.rdp-month+.rdp-month]:border-t-0 md:[&>.rdp-month+.rdp-month]:border-l',
          defaultClassNames.months
        ),
        month: cn(
          'relative flex flex-col w-full gap-4 md:px-4',
          defaultClassNames.month
        ),
        nav: cn(
          'flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between',
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) aria-disabled:opacity-50 p-0 select-none',
          'absolute top-0 left-0 z-10',
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) aria-disabled:opacity-50 p-0 select-none',
          'absolute top-0 right-0 z-10',
          defaultClassNames.button_next
        ),
        month_caption: cn(
          'flex items-center justify-center h-(--cell-size) w-full px-(--cell-size)',
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          'w-full flex items-center text-sm font-medium justify-center h-(--cell-size) gap-1.5',
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn('relative', defaultClassNames.dropdown_root),
        dropdown: cn('absolute bg-white inset-0 opacity-0', defaultClassNames.dropdown),
        caption_label: cn(
          'select-none font-medium text-slate-900',
          captionLayout === 'label'
            ? 'text-sm'
            : 'rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-slate-400 [&>svg]:size-3.5',
          defaultClassNames.caption_label
        ),
        table: 'w-full border-collapse',
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'text-slate-400 rounded-md flex-1 font-normal text-[0.8rem] select-none',
          defaultClassNames.weekday
        ),
        week: cn('flex w-full mt-0.5', defaultClassNames.week),
        week_number_header: cn(
          'select-none w-(--cell-size)',
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          'text-[0.8rem] select-none text-slate-400',
          defaultClassNames.week_number
        ),
        day: cn(
          'relative flex w-full h-full items-center justify-center px-1.5 py-0.5 text-center group/day aspect-square select-none',
          defaultClassNames.day
        ),
        range_start: cn(defaultClassNames.range_start),
        range_middle: cn(defaultClassNames.range_middle),
        range_end: cn(defaultClassNames.range_end),
        today: cn('rounded-md', defaultClassNames.today),
        outside: cn(
          'text-slate-400 aria-selected:text-slate-400',
          defaultClassNames.outside
        ),
        disabled: cn('text-slate-300 opacity-50', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => (
          <div
            data-slot="calendar"
            ref={rootRef}
            className={cn(className)}
            {...props}
          />
        ),
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === 'left')
            return <ChevronLeftIcon className={cn('size-4', className)} {...props} />;
          if (orientation === 'right')
            return <ChevronRightIcon className={cn('size-4', className)} {...props} />;
          return <ChevronDownIcon className={cn('size-4', className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => (
          <td {...props}>
            <div className="flex size-(--cell-size) items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
      {...props}
    />
  );
}

/**
 * The brand palm mark drawn as a soft watermark behind the date number on every
 * night of the selected stay — cyan on the lighter in-between nights, flipped to
 * white on the solid check-in/out circles.
 */
function StayPalm({ onSolid }: { onSolid: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/svg/heyvacay-logo-mini.svg"
        alt=""
        className="h-3/5 w-3/5 object-contain"
        style={
          onSolid
            ? { filter: 'brightness(0) invert(1)', opacity: 0.65 }
            : { opacity: 0.42 }
        }
      />
    </span>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  children,
  ...props
}: Omit<React.ComponentProps<typeof DayButton>, 'color'>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const inStay = !!(
    modifiers.range_start ||
    modifiers.range_middle ||
    modifiers.range_end
  );
  const onSolidFill = !!(modifiers.range_start || modifiers.range_end);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={numericDay(day.date)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-today={modifiers.today && !modifiers.selected}
      className={cn(
        'data-[selected-single=true]:bg-[#23e3ef] data-[selected-single=true]:text-[#0a1426] data-[range-middle=true]:bg-[#b9fbff] data-[range-middle=true]:text-[#0a1426] data-[range-start=true]:bg-[#23e3ef] data-[range-start=true]:text-[#0a1426] data-[range-end=true]:bg-[#23e3ef] data-[range-end=true]:text-[#0a1426] data-[today=true]:rounded-full data-[today=true]:ring-1 data-[today=true]:ring-inset data-[today=true]:ring-[#23e3ef] data-[today=true]:font-semibold data-[today=true]:text-[#10c3d4] relative isolate flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none text-[12px] font-normal data-[range-end=true]:rounded-full data-[range-middle=true]:rounded-full data-[range-start=true]:rounded-full [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className
      )}
      {...props}
    >
      {inStay && <StayPalm onSolid={onSolidFill} />}
      {children}
    </Button>
  );
}

export { Calendar, CalendarDayButton };
