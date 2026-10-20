'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from './cn';

export function Popover(
  props: React.ComponentProps<typeof PopoverPrimitive.Root>
) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

export function PopoverTrigger(
  props: React.ComponentProps<typeof PopoverPrimitive.Trigger>
) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export function PopoverAnchor(
  props: React.ComponentProps<typeof PopoverPrimitive.Anchor>
) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-lg outline-none',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
