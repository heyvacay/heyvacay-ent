import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/**
 * Button used inside the date picker — the same shape as HeyVacay.co's core
 * Button, with its design tokens resolved to concrete values so the calendar
 * renders identically inside the enterprise app's theme. Brand cyan is #23e3ef
 * (matches the app's --color-brand).
 */
const baseClasses =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-[#23e3ef]/40";

export const buttonVariants = cva(baseClasses, {
  variants: {
    variant: {
      default: 'bg-[#23e3ef] text-[#0a1426] hover:bg-[#23e3ef]/80',
      outline: 'border border-slate-200 bg-white hover:bg-slate-50',
      ghost: 'hover:bg-slate-100 hover:text-slate-900',
      link: 'text-[#10c3d4] underline-offset-4 hover:underline',
    },
    size: {
      default: 'px-4 py-1.5 text-sm has-[>svg]:px-3',
      sm: 'gap-1.5 px-3 py-2 text-sm has-[>svg]:px-2.5',
      lg: 'px-6 py-2.5 text-base has-[>svg]:px-4',
      icon: 'size-9',
    },
    radius: {
      none: 'rounded-none',
      sm: 'rounded-sm',
      md: 'rounded-md',
      lg: 'rounded-lg',
      full: 'rounded-full',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
    radius: 'md',
  },
});

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, radius, asChild = false, ...props }, ref) => {
    const Comp: React.ElementType = asChild ? Slot : 'button';
    return (
      <Comp
        data-slot="button"
        ref={ref}
        className={cn(buttonVariants({ variant, size, radius }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
