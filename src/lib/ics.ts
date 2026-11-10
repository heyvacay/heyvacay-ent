/**
 * Minimal iCalendar (.ics) generation so travelers can sync their trips to
 * Google Calendar, Apple Calendar, or Outlook. Produces an all-day VEVENT per
 * trip. This is a real, standards-compliant feed the calendar apps understand.
 */

export interface CalendarItem {
  id: string;
  title: string;
  location?: string;
  /** ISO yyyy-mm-dd (inclusive). */
  startDate: string;
  /** ISO yyyy-mm-dd (inclusive). */
  endDate: string;
  description?: string;
}

function toICSDate(iso: string): string {
  return iso.replace(/-/g, '');
}

function addDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildICS(items: CalendarItem[], calName = 'HeyVacay Trips'): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HeyVacay//Enterprise//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calName)}`,
  ];
  for (const it of items) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${it.id}@heyvacay`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toICSDate(it.startDate)}`,
      // DTEND is exclusive for all-day events, so add a day.
      `DTEND;VALUE=DATE:${toICSDate(addDay(it.endDate))}`,
      `SUMMARY:${esc(it.title)}`,
    );
    if (it.location) lines.push(`LOCATION:${esc(it.location)}`);
    if (it.description) lines.push(`DESCRIPTION:${esc(it.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Trigger a browser download of an .ics file. */
export function downloadICS(items: CalendarItem[], filename = 'heyvacay-trips.ics'): void {
  const blob = new Blob([buildICS(items)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
