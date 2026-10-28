'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { useEvents } from '@/lib/eventsStore';
import {
  Button,
  Field,
  Input,
  PageHeader,
  Select,
  Card,
  EmptyState,
  cn,
} from '@/components/app/ui';
import { money, num, todayISO, addDays, daysUntil, dateRange } from '@/lib/format';
import { rewardsFor } from '@/lib/rewards';
import { HvRangeField, HvDateField } from '@/components/datepicker/HvDatePicker';
import { ActiveTripBanner } from '@/components/app/ActiveTripBanner';
import { OfferBanner } from '@/components/app/OfferBanner';
import { format as fmtDate, parseISO } from 'date-fns';
import {
  placesFlights,
  placesHotels,
  type FlightPlace,
  type HotelPlace,
} from '@/lib/search';
import { useRouter } from 'next/navigation';
import { Train, Car } from 'lucide-react';

type ProductType = BookingType | 'train' | 'car';
const PRODUCTS: {
  key: ProductType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'flight', label: 'Flights', Icon: Plane },
  { key: 'hotel', label: 'Hotels', Icon: Receipt },
  { key: 'train', label: 'Trains', Icon: Train },
  { key: 'car', label: 'Cars', Icon: Car },
];
import {
  Plane,
  Receipt,
  Check,
  Shield,
  Gift,
  Building,
  MapPin,
  Sparkles,
  Calendar,
} from '@/components/icons';
import type {
  BookingType,
  InventoryOption,
  FlightDetails,
  HotelDetails,
} from '@/lib/types';
import type { PolicyFlag } from '@/lib/store';

/** Why-book-here perks shown on the employee home before a search. */
const PERKS = [
  {
    Icon: Check,
    t: 'In policy, automatically',
    d: 'Every result flags what needs approval before you book.',
  },
  {
    Icon: Gift,
    t: 'Points you keep',
    d: 'Earn on every trip and spend them on your own HeyVacay getaways.',
  },
  {
    Icon: Sparkles,
    t: 'Always below market',
    d: 'The same live inventory as HeyVacay.co, at corporate rates.',
  },
];

/* ---------------- helpers ---------------- */

function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function durLabel(mins?: number): string {
  if (mins == null) return '';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
function stopsLabel(stops?: number): string {
  if (!stops || stops <= 0) return 'Direct';
  return stops === 1 ? '1 stop' : `${stops} stops`;
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-slate-300 border-t-brand',
        className ?? 'h-4 w-4'
      )}
    />
  );
}

function Stars({ n = 0 }: { n?: number }) {
  return (
    <span className="text-sm leading-none">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? 'text-amber-400' : 'text-slate-200'}>
          ★
        </span>
      ))}
    </span>
  );
}

/** The enterprise overlay every result carries: policy + savings + points. */
function Signals({
  flags,
  savings,
  points,
}: {
  flags: PolicyFlag[];
  savings: number;
  points: number;
}) {
  const needsApproval = flags.some(
    (f) => f.policy.action === 'approve' || f.policy.action === 'block'
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      {flags.length === 0 ? (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" /> In policy
        </span>
      ) : needsApproval ? (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Shield className="h-3.5 w-3.5" /> Needs approval
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Shield className="h-3.5 w-3.5" /> Policy note
        </span>
      )}
      {savings > 0 && (
        <span className="font-semibold text-emerald-600">
          Saves company {money(savings)}
        </span>
      )}
      <span className="inline-flex items-center gap-1 font-semibold text-brand-dark">
        <Gift className="h-3.5 w-3.5" /> +{num(points)} pts
      </span>
    </div>
  );
}

/** Hotel photo with a branded fallback tile if the image can't load. */
function HotelImage({ src, alt }: { src?: string; alt: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className="relative h-44 w-full bg-gradient-to-br from-slate-200 to-brand/25">
      <span className="absolute inset-0 grid place-items-center text-slate-400">
        <Building className="h-8 w-8" />
      </span>
      {ok && src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

function AirlineBadge({ iata, logo }: { iata?: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      // Airline logos come from Duffel's CDN; plain img avoids remote-domain config.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={iata ?? 'Airline'}
        width={36}
        height={36}
        onError={() => setFailed(true)}
        className="h-9 w-9 shrink-0 rounded-full object-contain"
      />
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/10 text-xs font-bold text-brand-dark">
      {iata ?? <Plane className="h-4 w-4" />}
    </span>
  );
}

/** Placeholder for verticals we're still onboarding suppliers for. */
function ComingSoon({ product }: { product: ProductType }) {
  const isTrain = product === 'train';
  const Icon = isTrain ? Train : Car;
  const label = isTrain ? 'Trains' : 'Rental cars';
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand-dark">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-3 font-display text-lg font-bold text-slate-900">
        {label} are almost here
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        We&apos;re onboarding {isTrain ? 'rail' : 'car-rental'} suppliers so your
        team can book {label.toLowerCase()} in policy, right alongside flights and
        hotels.
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-dark ring-1 ring-slate-200">
        <Sparkles className="h-3.5 w-3.5" /> Coming soon
      </span>
    </div>
  );
}

/* ---------------- details view ---------------- */

function layoverLabel(aIso: string, bIso: string): string {
  const mins = Math.round(
    (new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000
  );
  return Number.isFinite(mins) && mins > 0 ? durLabel(mins) : '';
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

function CondChip({ label, val }: { label: string; val?: boolean | null }) {
  if (val == null) return null;
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-xs font-medium',
        val ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
      )}
    >
      {val ? '✓' : '✕'} {label}
    </span>
  );
}

function FlightDetailBody({ d }: { d: FlightDetails }) {
  const multi = d.slices.length > 1;
  return (
    <div className="space-y-5">
      {d.slices.map((slice, si) => (
        <div key={si}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">
              {multi ? (si === 0 ? 'Outbound' : 'Return') : 'Itinerary'} ·{' '}
              {slice.originIata} → {slice.destIata}
            </p>
            <p className="text-xs text-slate-400">
              {durLabel(slice.durationMins)} · {stopsLabel(slice.stops)}
            </p>
          </div>
          <div className="space-y-2">
            {slice.segments.map((sg, gi) => (
              <div key={gi}>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                      <AirlineBadge iata={sg.carrierIata} logo={sg.carrierLogo} />
                      {sg.carrier}
                      {sg.flightNumber && (
                        <span className="text-xs text-slate-400">
                          {sg.carrierIata}
                          {sg.flightNumber}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-400">
                      {durLabel(sg.durationMins)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        {fmtTime(sg.departAt)}
                      </div>
                      <div className="text-xs text-slate-400">{sg.originIata}</div>
                    </div>
                    <div className="flex-1 border-t border-dashed border-slate-200" />
                    <div className="text-left">
                      <div className="font-semibold text-slate-900">
                        {fmtTime(sg.arriveAt)}
                      </div>
                      <div className="text-xs text-slate-400">{sg.destIata}</div>
                    </div>
                  </div>
                  {sg.aircraft && (
                    <p className="mt-1 text-xs text-slate-400">{sg.aircraft}</p>
                  )}
                </div>
                {gi < slice.segments.length - 1 && (
                  <p className="py-1 pl-3 text-xs font-medium text-amber-600">
                    Layover{' '}
                    {layoverLabel(sg.arriveAt, slice.segments[gi + 1].departAt)} in{' '}
                    {sg.destIata}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {d.cabin && (
        <p className="text-xs text-slate-500">
          Cabin: <span className="font-medium text-slate-700">{d.cabin}</span>
        </p>
      )}
      {d.conditions && (
        <div className="flex flex-wrap gap-2">
          <CondChip label="Changeable" val={d.conditions.changeable} />
          <CondChip label="Refundable" val={d.conditions.refundable} />
          {d.conditions.carryOn != null && (
            <Chip>{d.conditions.carryOn} carry-on</Chip>
          )}
          {d.conditions.checked != null && (
            <Chip>
              {d.conditions.checked} checked bag
              {d.conditions.checked === 1 ? '' : 's'}
            </Chip>
          )}
        </div>
      )}
    </div>
  );
}

function HotelDetailBody({ d, opt }: { d: HotelDetails; opt: InventoryOption }) {
  return (
    <div className="space-y-3">
      <HotelImage src={d.images[0] || opt.imageUrl} alt={opt.title} />
      {d.images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {d.images.slice(1, 5).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              className="h-16 w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Stars n={opt.star} />
        {opt.rating != null && (
          <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand-dark">
            {opt.rating.toFixed(1)}
          </span>
        )}
        {d.reviews != null && (
          <span className="text-xs text-slate-400">{num(d.reviews)} reviews</span>
        )}
      </div>
      {d.address && <p className="text-sm text-slate-500">{d.address}</p>}
      {d.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {d.amenities.map((a) => (
            <Chip key={a}>{a}</Chip>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailsModal({
  opt,
  signal,
  onClose,
  onSelect,
}: {
  opt: InventoryOption;
  signal: { flags: PolicyFlag[]; savings: number; points: number };
  onClose: () => void;
  onSelect: () => void;
}) {
  const d = opt.details;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold text-slate-900">
              {opt.title}
            </h2>
            <p className="truncate text-xs text-slate-400">
              {opt.location ? `${opt.location} · ` : ''}
              {opt.detail}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {d?.kind === 'flight' && <FlightDetailBody d={d} />}
          {d?.kind === 'hotel' && <HotelDetailBody d={d} opt={opt} />}
          <div className="rounded-xl bg-slate-50 p-3">
            <Signals
              flags={signal.flags}
              savings={signal.savings}
              points={signal.points}
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              {signal.savings > 0 && (
                <span className="text-sm text-slate-400 line-through">
                  {money(opt.marketPrice)}
                </span>
              )}
              <span className="font-display text-xl font-bold text-slate-900">
                {money(opt.price)}
              </span>
            </div>
            {opt.type === 'hotel' && (
              <p className="text-xs text-slate-400">
                {money(Math.round(opt.price / (opt.nights || 1)))}/night · incl.
                taxes
              </p>
            )}
          </div>
          <Button onClick={onSelect}>
            {opt.type === 'flight' ? 'Select' : 'Reserve'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- typeahead field ---------------- */

interface Suggestion {
  key: string;
  label: string;
  sub?: string;
}

/**
 * Debounced destination/airport picker. Fetches suggestions from the backend
 * (via our proxy) so the code/region id we send to search is one the provider
 * actually recognizes — this is what makes "search any city" real.
 */
function PlaceField<T extends Suggestion>({
  label,
  placeholder,
  value,
  onChange,
  fetcher,
  onPick,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  fetcher: (q: string) => Promise<T[]>;
  onPick: (s: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the latest fetcher in a ref so the debounce effect depends only on the
  // query text — the fetcher is an inline arrow that changes identity every
  // render, and the effect itself flips `loading`, so depending on it would
  // loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetcherRef.current(q);
        if (live) setItems(res);
      } finally {
        if (live) setLoading(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <Field label={label}>
      <div ref={boxRef} className="relative">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner />
          </span>
        )}
        {open && items.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((it) => (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(it);
                    onChange(it.label);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-dark" />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800">{it.label}</span>
                    {it.sub && (
                      <span className="block truncate text-xs text-slate-400">{it.sub}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

/* ---------------- page ---------------- */

type FlightSug = FlightPlace & Suggestion;
type HotelSug = HotelPlace & Suggestion;

export default function BookPage() {
  const { state, role, activeUser, evaluatePolicies, book, pointsBalance, approvalModeFor } =
    useStore();
  const { events } = useEvents();
  const router = useRouter();
  const canBookForOthers = role === 'admin' || role === 'booker';

  const [type, setType] = useState<ProductType>('hotel');

  // flight inputs
  const [originText, setOriginText] = useState('');
  const [origin, setOrigin] = useState<FlightPlace | null>(null);
  const [destText, setDestText] = useState('');
  const [dest, setDest] = useState<FlightPlace | null>(null);
  const [roundTrip, setRoundTrip] = useState(true);
  const [cabin, setCabin] = useState('economy');

  // hotel inputs
  const [hotelText, setHotelText] = useState('');
  const [hotelPlace, setHotelPlace] = useState<HotelPlace | null>(null);

  // shared
  const [start, setStart] = useState(addDays(todayISO(), 14));
  const [end, setEnd] = useState(addDays(todayISO(), 17));
  const [travelerId, setTravelerId] = useState(activeUser.id);
  const [eventId, setEventId] = useState('');

  // Booking approval mode for whoever the trip is for.
  const approvalMode = approvalModeFor(travelerId);
  // Events this traveler can book against (they're an attendee; admins see all).
  const bookableEvents = events.filter(
    (e) => role === 'admin' || e.attendees.some((a) => a.userId === travelerId)
  );
  const selectedEvent = bookableEvents.find((e) => e.id === eventId);
  // Company requires approval on every booking.
  const forceApproval = approvalMode === 'pre_approval';
  // Event-only hotel flow: lock to the event city and the allow-listed hotels.
  const eventOnlyHotel = approvalMode === 'event_required' && !!selectedEvent;
  const allowHotels = selectedEvent?.allowHotelList ?? [];

  const bookAllowHotel = (h: { hid: string; name: string }) => {
    if (!selectedEvent) return;
    if (new Date(end) <= new Date(start)) {
      setError('Check-out must be after check-in.');
      return;
    }
    const q = new URLSearchParams();
    q.set('checkin', start);
    q.set('checkout', end);
    q.set('adults', '1');
    q.set('label', h.name);
    q.set('travelerId', travelerId);
    q.set('eventId', selectedEvent.id);
    q.set('eventName', selectedEvent.name);
    q.set('eventAllow', '1');
    router.push(`/app/hotels/${h.hid}?${q.toString()}`);
  };

  const [results, setResults] = useState<InventoryOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    opt: InventoryOption;
    pending: boolean;
    points: number;
  } | null>(null);
  const [detailOpt, setDetailOpt] = useState<InventoryOption | null>(null);

  const switchType = (t: ProductType) => {
    setType(t);
    setResults(null);
    setError(null);
  };

  // Dates flow through the app as ISO 'yyyy-MM-dd' strings; the calendar works
  // in Date objects, so convert at the boundary.
  const toISO = (d: Date) => fmtDate(d, 'yyyy-MM-dd');
  const dStart = start ? parseISO(start) : undefined;
  const dEnd = end ? parseISO(end) : undefined;

  // Enterprise context for the home (the "changes for company policies" twist).
  const firstName = activeUser.name.split(' ')[0];
  const myTrips = state.bookings.filter(
    (b) => b.travelerId === activeUser.id && b.status !== 'cancelled'
  );
  const mySaved = myTrips.reduce((s, b) => s + b.savings, 0);
  const myPoints = pointsBalance(activeUser.id);
  const nextTrip = myTrips
    .filter((b) => daysUntil(b.startDate) >= 0)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0];
  const policyChips = state.policies
    .filter((p) => p.enabled)
    .map((p) => {
      switch (p.type) {
        case 'max_hotel_star':
          return `Up to ${p.value}★ hotels`;
        case 'max_nightly':
          return `≤ ${money(Number(p.value))}/night`;
        case 'max_cabin':
          return `${String(p.value)} cabin max`;
        case 'flight_cabin_by_duration':
          return `${p.tiers?.[0]?.cabin ?? 'Economy'} on short flights`;
        case 'advance_days':
          return `Book ${p.value}+ days ahead`;
        default:
          return undefined;
      }
    })
    .filter((x): x is string => Boolean(x));

  const sig = (opt: InventoryOption) => {
    const flags = evaluatePolicies(opt, start);
    const { savings, points } = rewardsFor(opt);
    const pending =
      forceApproval ||
      flags.some((f) => f.policy.action === 'approve' || f.policy.action === 'block');
    return { flags, savings, points, pending };
  };

  const runSearch = async () => {
    setError(null);
    setConfirmed(null);
    if (approvalMode === 'event_required' && !eventId) {
      setError(
        'Your company only allows booking against an approved event. Pick an event to continue.'
      );
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      if (type === 'flight') {
        // Resolve typed text to an airport if the traveler didn't pick one.
        let o = origin;
        let d = dest;
        if (!o && originText.trim()) o = (await placesFlights(originText))[0] ?? null;
        if (!d && destText.trim()) d = (await placesFlights(destText))[0] ?? null;
        if (!o || !d) throw new Error('Pick an origin and destination airport to search.');
        setOrigin(o);
        setDest(d);
        // Flights get their own results page (like HeyVacay.co).
        const q = new URLSearchParams();
        q.set('origin', o.code);
        q.set('destination', d.code);
        q.set('depart', start);
        if (roundTrip) q.set('return', end);
        q.set('cabin', cabin);
        q.set('travelerId', travelerId);
        if (eventId && selectedEvent) {
          q.set('eventId', eventId);
          q.set('eventName', selectedEvent.name);
        }
        router.push(`/app/flights?${q.toString()}`);
        return;
      } else {
        let p = hotelPlace;
        if (!p && hotelText.trim()) p = (await placesHotels(hotelText))[0] ?? null;
        if (!p) throw new Error('Pick a destination to search.');
        setHotelPlace(p);
        if (new Date(end) <= new Date(start))
          throw new Error('Check-out must be after check-in.');
        // Hotels get their own results page (like HeyVacay.co).
        const q = new URLSearchParams();
        q.set('checkin', start);
        q.set('checkout', end);
        q.set('adults', '1');
        q.set('label', p.label);
        if (p.regionId) q.set('regionId', String(p.regionId));
        else if (p.lat != null && p.lng != null) {
          q.set('lat', String(p.lat));
          q.set('lng', String(p.lng));
        }
        if (p.hid) q.set('hid', String(p.hid));
        q.set('travelerId', travelerId);
        if (eventId && selectedEvent) {
          q.set('eventId', eventId);
          q.set('eventName', selectedEvent.name);
        }
        router.push(`/app/hotels?${q.toString()}`);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirm = (opt: InventoryOption) => {
    const { pending, points } = sig(opt);
    book({
      opt,
      travelerId,
      startDate: start,
      endDate: end,
      eventId: eventId || undefined,
      eventName: selectedEvent?.name,
    });
    setConfirmed({ opt, pending, points });
    setResults(null);
  };

  /* ----- confirmation ----- */
  if (confirmed) {
    const savings = rewardsFor(confirmed.opt).savings;
    return (
      <div>
        <PageHeader title="Booking" subtitle="You just booked smart." />
        <Card className="mx-auto max-w-xl text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">
            {confirmed.pending ? 'Sent for approval' : 'Trip confirmed'}
          </h2>
          <p className="mt-1 text-slate-500">
            {confirmed.opt.title} · {confirmed.opt.detail}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-400">Price</p>
              <p className="font-display text-lg font-bold text-slate-900">
                {money(confirmed.opt.price)}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs text-emerald-600">Saved</p>
              <p className="font-display text-lg font-bold text-emerald-700">
                {money(savings)}
              </p>
            </div>
            <div className="rounded-xl bg-brand/10 p-4">
              <p className="text-xs text-brand-dark">Points</p>
              <p className="font-display text-lg font-bold text-brand-dark">
                {confirmed.pending ? '—' : `+${num(confirmed.points)}`}
              </p>
            </div>
          </div>
          {confirmed.pending && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {forceApproval
                ? 'Your company requires manager approval on every booking, so this trip was sent for approval. Points land once it’s approved.'
                : 'This trip needs manager approval under your travel policy. Points land once it’s approved.'}
            </p>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <Button href="/app/trips">View my trips</Button>
            <Button variant="outline" onClick={() => setConfirmed(null)}>
              Book another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ----- search home + results ----- */
  return (
    <div>
      {/* Manager counter-offers awaiting the traveler. */}
      <OfferBanner />

      {/* Context-aware greeting when the traveler is on / about to start a trip. */}
      <ActiveTripBanner />

      {(() => {
        const mine = events
          .filter(
            (e) =>
              e.attendees.some((a) => a.userId === activeUser.id) && daysUntil(e.endDate) >= 0
          )
          .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
        const ev = mine[0];
        if (!ev) return null;
        return (
          <Link
            href={`/app/events/${ev.id}`}
            className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4 transition hover:border-brand/50"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-dark">
                <Calendar className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  You&apos;re going to {ev.name}
                </p>
                <p className="text-xs text-slate-500">
                  {ev.city} · {dateRange(ev.startDate, ev.endDate)}
                  {ev.dinner ? ' · dinner is being planned — RSVP inside' : ''}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-brand-dark">View →</span>
          </Link>
        );
      })()}

      {forceApproval && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Your company requires approval on all bookings
            </p>
            <p className="text-sm text-amber-700">
              Every trip you book is sent to a manager for approval before it&apos;s confirmed —
              nothing books instantly.
            </p>
          </div>
        </div>
      )}

      {/* hero — the employee home: search first, with a HeyVacay feel */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-surface to-navy-deep p-6 text-white ring-1 ring-white/10 sm:p-8">
        <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            {state.company.name} · corporate travel
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            Where to, {firstName}?
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-mist/80 sm:text-base">
            Search live flights and hotels — always below market, always in your
            company&apos;s policy. Every trip earns points you keep.
          </p>

          {/* product switcher */}
          <div className="mt-6 inline-flex flex-wrap rounded-full bg-white/10 p-1 ring-1 ring-white/15 backdrop-blur">
            {PRODUCTS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => switchType(key)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors',
                  type === key
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-white/70 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* search card floating over the hero */}
          <div className="mt-4 rounded-2xl bg-white p-4 text-slate-900 shadow-xl ring-1 ring-black/5 sm:p-5">
            {type === 'flight' ? (
          <>
            <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
              {(
                [
                  ['round', 'Round trip'],
                  ['oneway', 'One way'],
                ] as const
              ).map(([v, lbl]) => (
                <button
                  key={v}
                  onClick={() => setRoundTrip(v === 'round')}
                  className={cn(
                    'rounded-md px-3 py-1 font-semibold transition-colors',
                    roundTrip === (v === 'round')
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500'
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PlaceField<FlightSug>
                label="From"
                placeholder="City or airport"
                value={originText}
                onChange={(v) => {
                  setOriginText(v);
                  setOrigin(null);
                }}
                fetcher={async (q) =>
                  (await placesFlights(q)).map((p) => ({ ...p, key: p.code }))
                }
                onPick={(s) => setOrigin(s)}
              />
              <PlaceField<FlightSug>
                label="To"
                placeholder="City or airport"
                value={destText}
                onChange={(v) => {
                  setDestText(v);
                  setDest(null);
                }}
                fetcher={async (q) =>
                  (await placesFlights(q)).map((p) => ({ ...p, key: p.code }))
                }
                onPick={(s) => setDest(s)}
              />
              {roundTrip ? (
                <Field label="Dates">
                  <HvRangeField
                    value={{ from: dStart, to: dEnd }}
                    onChange={(r) => {
                      if (r?.from) setStart(toISO(r.from));
                      if (r?.to) setEnd(toISO(r.to));
                    }}
                  />
                </Field>
              ) : (
                <Field label="Depart">
                  <HvDateField
                    value={dStart}
                    onChange={(d) => d && setStart(toISO(d))}
                  />
                </Field>
              )}
              <Field label="Cabin">
                <Select value={cabin} onChange={(e) => setCabin(e.target.value)}>
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium economy</option>
                  <option value="business">Business</option>
                  <option value="first">First</option>
                </Select>
              </Field>
              <Field label="Traveler">
                {canBookForOthers ? (
                  <Select
                    value={travelerId}
                    onChange={(e) => setTravelerId(e.target.value)}
                  >
                    {state.users
                      .filter((u) => u.status === 'active')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <Input value={activeUser.name} disabled />
                )}
              </Field>
            </div>
          </>
        ) : type === 'hotel' ? (
          eventOnlyHotel ? (
            <div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Destination (event city)">
                  <Input value={selectedEvent!.city} disabled />
                </Field>
                <Field label="Dates">
                  <HvRangeField
                    value={{ from: dStart, to: dEnd }}
                    maxRangeDays={30}
                    onChange={(r) => {
                      if (r?.from) setStart(toISO(r.from));
                      if (r?.to) setEnd(toISO(r.to));
                    }}
                  />
                </Field>
                <Field label="Guest">
                  {canBookForOthers ? (
                    <Select value={travelerId} onChange={(e) => setTravelerId(e.target.value)}>
                      {state.users
                        .filter((u) => u.status === 'active')
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </Select>
                  ) : (
                    <Input value={activeUser.name} disabled />
                  )}
                </Field>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Allowed hotels for {selectedEvent!.name}
                </p>
                {allowHotels.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                    No hotels have been allow-listed for this event yet.{' '}
                    {role === 'admin'
                      ? 'Add them on the event page.'
                      : 'Ask your admin to add hotels to the event.'}
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {allowHotels.map((h) => (
                      <div
                        key={h.hid}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                          <Building className="h-4 w-4 shrink-0 text-brand-dark" />
                          <span className="truncate">{h.name}</span>
                        </span>
                        <Button size="sm" onClick={() => bookAllowHotel(h)}>
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  In event-only booking you can book any allow-listed hotel without approval — even
                  if it&apos;s outside normal policy.
                </p>
              </div>
            </div>
          ) : approvalMode === 'event_required' ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
              Choose an event below to see its allow-listed hotels.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PlaceField<HotelSug>
                label="Destination"
                placeholder="City"
                value={hotelText}
                onChange={(v) => {
                  setHotelText(v);
                  setHotelPlace(null);
                }}
                fetcher={async (q) =>
                  (await placesHotels(q)).map((p) => ({
                    ...p,
                    key: p.type === 'region' ? `r${p.regionId}` : `h${p.hid}`,
                  }))
                }
                onPick={(s) => setHotelPlace(s)}
              />
              <Field label="Dates">
                <HvRangeField
                  value={{ from: dStart, to: dEnd }}
                  maxRangeDays={30}
                  onChange={(r) => {
                    if (r?.from) setStart(toISO(r.from));
                    if (r?.to) setEnd(toISO(r.to));
                  }}
                />
              </Field>
              <Field label="Guest">
                {canBookForOthers ? (
                  <Select value={travelerId} onChange={(e) => setTravelerId(e.target.value)}>
                    {state.users
                      .filter((u) => u.status === 'active')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <Input value={activeUser.name} disabled />
                )}
              </Field>
            </div>
          )
        ) : (
          <ComingSoon product={type} />
        )}

            {(type === 'flight' || type === 'hotel') && (
              <div className="mt-3">
                <Field
                  label={approvalMode === 'event_required' ? 'Event (required)' : 'Event'}
                  hint={
                    approvalMode === 'event_required'
                      ? 'Your company only allows booking against an approved event.'
                      : 'Optional — tie this trip to a company event.'
                  }
                >
                  <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                    <option value="">
                      {approvalMode === 'event_required'
                        ? 'Select an event…'
                        : 'No event (personal / ad-hoc)'}
                    </option>
                    {bookableEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} · {ev.city}
                      </option>
                    ))}
                  </Select>
                </Field>
                {approvalMode === 'event_required' && bookableEvents.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    You&apos;re not part of any event yet.{' '}
                    {role === 'admin' || role === 'booker'
                      ? 'Create one on the Events page.'
                      : 'Ask your manager to add you to one.'}
                  </p>
                )}
                {approvalMode === 'pre_approval' && (
                  <p className="mt-2 text-xs text-slate-500">
                    Every booking is sent to your manager for approval before it&apos;s confirmed.
                  </p>
                )}
              </div>
            )}

            {(type === 'flight' || (type === 'hotel' && !eventOnlyHotel)) && (
              <Button className="mt-4" onClick={runSearch} disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                    Searching…
                  </span>
                ) : (
                  `Search ${type === 'flight' ? 'flights' : 'hotels'}`
                )}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* enterprise context — shown on the home before a search runs */}
      {!loading && !error && !results && (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Your travel at a glance
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-brand/10 p-4">
                <p className="text-xs font-semibold text-brand-dark">Your points</p>
                <p className="font-display text-2xl font-bold text-brand-dark">
                  {num(myPoints)}
                </p>
                <p className="text-xs text-slate-400">yours to keep</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-600">
                  Saved the company
                </p>
                <p className="font-display text-2xl font-bold text-emerald-700">
                  {money(mySaved)}
                </p>
                <p className="text-xs text-slate-400">across your trips</p>
              </div>
              <div className="col-span-2 rounded-xl bg-slate-50 p-4 sm:col-span-1">
                <p className="text-xs font-semibold text-slate-500">Next trip</p>
                {nextTrip ? (
                  <>
                    <p className="truncate font-semibold text-slate-800">
                      {nextTrip.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {dateRange(nextTrip.startDate, nextTrip.endDate)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">Nothing booked yet.</p>
                )}
              </div>
            </div>
            {policyChips.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <Shield className="h-3.5 w-3.5 text-brand-dark" /> Your policy
                </span>
                {policyChips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Why book here
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              {PERKS.map(({ Icon, t, d }) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-dark">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-800">{t}</span>
                    <span className="block text-xs text-slate-400">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {error && (
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-700">{error}</p>
        </Card>
      )}

      {/* loading skeleton */}
      {loading && (
        <div className="mt-6 grid place-items-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
          <p className="mt-3 text-sm">Pulling live {type === 'flight' ? 'fares' : 'rates'}…</p>
        </div>
      )}

      {/* empty */}
      {!loading && results && results.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No results for those dates"
            sub="Try different dates or a nearby city — availability changes by the minute."
          />
        </div>
      )}

      {/* flight results */}
      {!loading && results && results.length > 0 && type === 'flight' && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-400">
            {results.length} live fares — sorted by best value.
          </p>
          {results.map((opt) => {
            const { flags, savings, points } = sig(opt);
            return (
              <Card key={opt.id} className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 sm:w-44">
                    <AirlineBadge iata={opt.airlineIata} logo={opt.airlineLogo} />
                    <span className="text-sm font-medium text-slate-800">
                      {opt.airline}
                    </span>
                  </div>

                  <div className="flex flex-1 items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-semibold text-slate-900">
                        {fmtTime(opt.departAt)}
                      </div>
                      <div className="text-xs text-slate-400">{opt.originIata}</div>
                    </div>
                    <div className="flex flex-1 flex-col items-center">
                      <div className="text-xs text-slate-400">
                        {durLabel(opt.durationMins)}
                      </div>
                      <div className="my-1 flex w-full items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full border border-slate-400" />
                        <span className="h-px flex-1 bg-slate-200" />
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px]',
                            !opt.stops
                              ? 'border-brand text-brand-dark'
                              : 'border-slate-300 text-slate-400'
                          )}
                        >
                          {stopsLabel(opt.stops)}
                        </span>
                        <span className="h-px flex-1 bg-slate-200" />
                        <Plane className="h-3 w-3 rotate-90 text-slate-400" />
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-semibold text-slate-900">
                        {fmtTime(opt.arriveAt)}
                      </div>
                      <div className="text-xs text-slate-400">{opt.destIata}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 sm:w-44">
                    <div className="flex items-center gap-2">
                      {savings > 0 && (
                        <span className="text-sm text-slate-400 line-through">
                          {money(opt.marketPrice)}
                        </span>
                      )}
                      <span className="text-xl font-bold text-slate-900">
                        {money(opt.price)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="mt-1 w-full"
                      onClick={() => confirm(opt)}
                    >
                      Select
                    </Button>
                    <button
                      type="button"
                      onClick={() => setDetailOpt(opt)}
                      className="text-xs font-medium text-brand-dark hover:underline"
                    >
                      View details
                    </button>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <Signals flags={flags} savings={savings} points={points} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* hotel results */}
      {!loading && results && results.length > 0 && type === 'hotel' && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-slate-400">
            {results.length} live stays — sorted by best value.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((opt) => {
              const { flags, savings, points } = sig(opt);
              const perNight = Math.round(opt.price / (opt.nights || 1));
              return (
                <Card key={opt.id} pad={false} className="flex flex-col overflow-hidden">
                  <HotelImage src={opt.imageUrl} alt={opt.title} />
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Stars n={opt.star} />
                      {opt.rating != null && (
                        <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-xs font-bold text-brand-dark">
                          {opt.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <h3 className="line-clamp-1 font-semibold text-slate-900">
                      {opt.title}
                    </h3>
                    <p className="line-clamp-1 text-sm text-slate-400">
                      {opt.location ? `${opt.location} · ` : ''}
                      {opt.detail}
                    </p>
                    <Signals flags={flags} savings={savings} points={points} />
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <div>
                        <div className="flex items-center gap-2">
                          {savings > 0 && (
                            <span className="text-sm text-slate-400 line-through">
                              {money(opt.marketPrice)}
                            </span>
                          )}
                          <span className="text-xl font-bold text-slate-900">
                            {money(opt.price)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {money(perNight)}/night · incl. taxes
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Button size="sm" onClick={() => confirm(opt)}>
                          Reserve
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDetailOpt(opt)}
                          className="text-xs font-medium text-brand-dark hover:underline"
                        >
                          View details
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {detailOpt && (
        <DetailsModal
          opt={detailOpt}
          signal={sig(detailOpt)}
          onClose={() => setDetailOpt(null)}
          onSelect={() => {
            const o = detailOpt;
            setDetailOpt(null);
            confirm(o);
          }}
        />
      )}
    </div>
  );
}
