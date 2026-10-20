import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Local cn for the vendored date-picker module (merges Tailwind classes). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
