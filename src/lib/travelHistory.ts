/** What a company's travel looked like over the prior year — used to tune
 *  savings estimates and set up sensible defaults. Entirely optional. */
export type TravelCategory = 'flights' | 'hotels' | 'train' | 'car' | 'other';

export interface TravelHistory {
  /** Total travel spend last year (USD). */
  lastYearSpend?: number;
  /** Where most of it went, if they know. */
  dominantCategory?: TravelCategory;
  /** Optional per-quarter breakdown (most recent four quarters). */
  quarters?: { label: string; spend: number }[];
}

export const TRAVEL_CATEGORIES: { key: TravelCategory; label: string; icon: string }[] = [
  { key: 'flights', label: 'Flights', icon: '✈️' },
  { key: 'hotels', label: 'Hotels', icon: '🏨' },
  { key: 'train', label: 'Train', icon: '🚆' },
  { key: 'car', label: 'Car rental', icon: '🚗' },
  { key: 'other', label: 'Other', icon: '•' },
];

/** Summarize a history for a note / audit line. Empty string when nothing set. */
export function summarizeTravelHistory(h: TravelHistory | undefined): string {
  if (!h) return '';
  if (!h.lastYearSpend && !h.dominantCategory && !(h.quarters?.length)) return '';
  const parts: string[] = [];
  if (h.lastYearSpend) parts.push(`~$${h.lastYearSpend.toLocaleString('en-US')} last year`);
  if (h.dominantCategory)
    parts.push(
      `mostly ${TRAVEL_CATEGORIES.find((c) => c.key === h.dominantCategory)?.label ?? h.dominantCategory}`
    );
  if (h.quarters?.length)
    parts.push(
      h.quarters
        .filter((q) => q.spend > 0)
        .map((q) => `${q.label} $${q.spend.toLocaleString('en-US')}`)
        .join(', ')
    );
  return parts.filter(Boolean).join(' · ');
}
