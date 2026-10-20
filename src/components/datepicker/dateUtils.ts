import { toZonedTime } from 'date-fns-tz';

/**
 * Today at midnight in the given IANA timezone (falls back to the browser's
 * local timezone). Used as the minimum selectable date so last-minute bookings
 * work off the booking city's local day.
 */
export function getCurrentDateInTimezone(timezone?: string): Date {
  const now = new Date();
  if (!timezone) {
    const localMidnight = new Date(now);
    localMidnight.setHours(0, 0, 0, 0);
    return localMidnight;
  }
  const zoned = toZonedTime(now, timezone);
  zoned.setHours(0, 0, 0, 0);
  return zoned;
}
