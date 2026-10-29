/**
 * Advanced reporting engine for Nova/Enterprise analytics.
 *
 * A deterministic synthetic transaction dataset (so reports are rich and
 * meaningful in the demo) + a tiny pivot engine + a natural-language parser
 * that turns a phrase like "amount for lufthansa in 2018 by top 10 countries by
 * report owner" into a structured query. Everything is pure + client-side.
 */

export type Dimension =
  | 'country'
  | 'city'
  | 'airline'
  | 'hotel'
  | 'department'
  | 'owner'
  | 'type'
  | 'year'
  | 'month';

export type Measure = 'amount' | 'count' | 'savings';

export interface ReportQuery {
  measure: Measure;
  groupBy: Dimension;
  splitBy?: Dimension;
  filters: { field: Dimension; value: string }[];
  limit?: number;
}

export interface Txn {
  id: string;
  date: string; // yyyy-mm-dd
  year: string;
  month: string; // Jan..Dec
  type: 'hotel' | 'flight';
  airline: string;
  hotel: string;
  city: string;
  country: string;
  department: string;
  owner: string; // report owner / account manager
  amount: number;
  savings: number;
}

export const DIMENSION_LABEL: Record<Dimension, string> = {
  country: 'Location Country',
  city: 'City',
  airline: 'Airline',
  hotel: 'Hotel',
  department: 'Department',
  owner: 'Report Owner',
  type: 'Product',
  year: 'Year',
  month: 'Month',
};

export const MEASURE_LABEL: Record<Measure, string> = {
  amount: 'Transaction Amount',
  count: 'Transaction Count',
  savings: 'Savings',
};

const AIRLINES = [
  'Lufthansa',
  'Delta',
  'United',
  'American',
  'British Airways',
  'Air France',
  'Emirates',
  'Alaska',
];
const HOTELS = [
  'Marriott',
  'Hilton',
  'Hyatt',
  'Four Seasons',
  'Kimpton',
  'Ritz-Carlton',
  'Accor',
];
const PLACES: { city: string; country: string }[] = [
  { city: 'New York', country: 'United States' },
  { city: 'San Francisco', country: 'United States' },
  { city: 'Austin', country: 'United States' },
  { city: 'London', country: 'United Kingdom' },
  { city: 'Frankfurt', country: 'Germany' },
  { city: 'Paris', country: 'France' },
  { city: 'Tokyo', country: 'Japan' },
  { city: 'Dubai', country: 'United Arab Emirates' },
  { city: 'Singapore', country: 'Singapore' },
  { city: 'Toronto', country: 'Canada' },
];
const DEPARTMENTS = ['Sales', 'Engineering', 'Marketing', 'Operations', 'Finance', 'Executive'];
const OWNERS = ['Danil B.', 'Priya N.', 'Marcus L.', 'Jordan K.', 'Sam R.'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Deterministic PRNG so the dataset is stable across renders. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CACHE = new Map<string, Txn[]>();

export interface OrgContext {
  owners?: string[];
  departments?: string[];
}

/**
 * The transaction ledger (cached per org context). When the company's real
 * owners/departments are provided, the Report Owner and Department dimensions
 * reflect the actual org — so filtering by a real person or team works — while
 * the airline/country/year breadth keeps reports meaningful.
 */
export function transactions(ctx?: OrgContext): Txn[] {
  const owners = ctx?.owners?.length ? ctx.owners : OWNERS;
  const departments = ctx?.departments?.length ? ctx.departments : DEPARTMENTS;
  const key = `${owners.join('|')}__${departments.join('|')}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  const rnd = mulberry32(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const rows: Txn[] = [];
  for (let i = 0; i < 600; i++) {
    const place = pick(PLACES);
    const year = String(2018 + Math.floor(rnd() * 9)); // 2018–2026
    const m = Math.floor(rnd() * 12);
    const type: 'hotel' | 'flight' = rnd() > 0.5 ? 'flight' : 'hotel';
    const amount = Math.round(200 + rnd() * 3800);
    rows.push({
      id: `tx_${i}`,
      date: `${year}-${String(m + 1).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 27)).padStart(2, '0')}`,
      year,
      month: MONTHS[m],
      type,
      airline: type === 'flight' ? pick(AIRLINES) : '—',
      hotel: type === 'hotel' ? pick(HOTELS) : '—',
      city: place.city,
      country: place.country,
      department: pick(departments),
      owner: pick(owners),
      amount,
      savings: Math.round(amount * (0.05 + rnd() * 0.25)),
    });
  }
  CACHE.set(key, rows);
  return rows;
}

const dimValue = (t: Txn, d: Dimension): string => String(t[d]);

export interface ReportRow {
  key: string;
  split?: string;
  value: number;
}

/** Run a query: filter → group → aggregate → sort → top-N. Pass the org's data
 *  (from transactions(ctx)) so reports reflect the real company. */
export function runReport(q: ReportQuery, data?: Txn[]): ReportRow[] {
  const rows = (data ?? transactions()).filter((t) =>
    q.filters.every((f) => dimValue(t, f.field).toLowerCase() === f.value.toLowerCase())
  );
  const agg = new Map<string, number>();
  for (const t of rows) {
    const k = q.splitBy ? `${dimValue(t, q.groupBy)}||${dimValue(t, q.splitBy)}` : dimValue(t, q.groupBy);
    const add = q.measure === 'count' ? 1 : q.measure === 'savings' ? t.savings : t.amount;
    agg.set(k, (agg.get(k) ?? 0) + add);
  }
  let out: ReportRow[] = Array.from(agg.entries()).map(([k, value]) => {
    const [key, split] = k.split('||');
    return { key, split, value };
  });
  out.sort((a, b) => b.value - a.value);
  if (q.limit && q.limit > 0) out = out.slice(0, q.limit);
  return out;
}

/* ---------------- natural-language parser ---------------- */

const MEASURE_WORDS: [RegExp, Measure][] = [
  [/\b(amount|spend|revenue|total|value|cost)\b/i, 'amount'],
  [/\b(saving|saved|savings)\b/i, 'savings'],
  [/\b(count|number of|how many|trips|transactions|bookings)\b/i, 'count'],
];

const DIM_WORDS: [RegExp, Dimension][] = [
  [/\b(countr(y|ies)|location)\b/i, 'country'],
  [/\b(cit(y|ies))\b/i, 'city'],
  [/\b(airlines?|carriers?)\b/i, 'airline'],
  [/\b(hotels?|propert(y|ies))\b/i, 'hotel'],
  [/\b(departments?|teams?)\b/i, 'department'],
  [/\b(report owner|owners?|account managers?|reps?)\b/i, 'owner'],
  [/\b(product|type|flights? or hotels?)\b/i, 'type'],
  [/\b(years?)\b/i, 'year'],
  [/\b(months?)\b/i, 'month'],
];

/** Parse a phrase into a ReportQuery (best-effort; always returns something).
 *  Pass the org's owners/departments so a real name or team filters correctly. */
export function parseQuery(text: string, ctx?: OrgContext): ReportQuery {
  const t = ` ${text.toLowerCase()} `;
  const measure = MEASURE_WORDS.find(([re]) => re.test(t))?.[1] ?? 'amount';

  // Dimensions, in the order they appear — first = groupBy, second = splitBy.
  const dims: { dim: Dimension; at: number }[] = [];
  for (const [re, dim] of DIM_WORDS) {
    const m = t.match(re);
    if (m && m.index != null && !dims.some((d) => d.dim === dim)) dims.push({ dim, at: m.index });
  }
  dims.sort((a, b) => a.at - b.at);
  const groupBy = dims[0]?.dim ?? 'country';
  const splitBy = dims[1]?.dim;

  const filters: ReportQuery['filters'] = [];
  // Year filter.
  const year = text.match(/\b(20\d{2})\b/);
  if (year) filters.push({ field: 'year', value: year[1] });
  // Airline filter.
  for (const a of AIRLINES) if (new RegExp(`\\b${a.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(text))
    filters.push({ field: 'airline', value: a });
  // Country filter.
  for (const p of PLACES) if (new RegExp(`\\b${p.country.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(text))
    if (!filters.some((f) => f.field === 'country')) filters.push({ field: 'country', value: p.country });
  // Department filter (real org departments when provided).
  for (const d of ctx?.departments?.length ? ctx.departments : DEPARTMENTS)
    if (new RegExp(`\\b${d.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(text))
      filters.push({ field: 'department', value: d });
  // Report-owner filter — match a real person's name (or first name).
  for (const o of ctx?.owners ?? [])
    if (
      new RegExp(`\\b${o.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(text) ||
      new RegExp(`\\b${o.split(' ')[0].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(text)
    )
      if (!filters.some((f) => f.field === 'owner')) filters.push({ field: 'owner', value: o });

  // top N.
  const top = text.match(/\btop\s+(\d+)\b/i);
  const limit = top ? Number(top[1]) : 10;

  // Don't group by a field we're filtering to a single value (redundant).
  const filteredFields = new Set(filters.map((f) => f.field));
  let g = groupBy;
  if (filteredFields.has(g) && dims[1]) g = dims[1].dim;

  return { measure, groupBy: g, splitBy: splitBy === g ? undefined : splitBy, filters, limit };
}

/** Human-readable restatement of a query. */
export function describeQuery(q: ReportQuery): string {
  const dims = [DIMENSION_LABEL[q.groupBy], q.splitBy ? DIMENSION_LABEL[q.splitBy] : null]
    .filter(Boolean)
    .join(', ');
  const top = q.limit ? `Top ${q.limit} ` : '';
  const filters = q.filters.length
    ? ` with filters on ${q.filters.map((f) => f.value).join(', ')}`
    : '';
  return `${top}${MEASURE_LABEL[q.measure]} by ${dims}${filters}`;
}
