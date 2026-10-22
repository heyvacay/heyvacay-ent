'use client';

/**
 * Client search layer. Calls the app's own /api proxy routes (same origin, no
 * CORS) and maps real HeyVacay backend offers into the InventoryOption shape
 * the booking UI and store already understand. All pricing/savings logic lives
 * here so the cards stay dumb.
 */
import type { InventoryOption } from './types';

/* ---------------- typeahead ---------------- */

export interface FlightPlace {
  code: string;
  label: string;
  sub: string;
}
export interface HotelPlace {
  type: 'region' | 'hotel';
  label: string;
  sub: string;
  regionId?: number;
  hid?: number;
  lat?: number;
  lng?: number;
  star?: number;
}

interface RawAirport {
  code: string;
  city?: string;
  name?: string;
  country?: string;
  type?: string;
}

export async function placesFlights(q: string): Promise<FlightPlace[]> {
  if (q.trim().length < 2) return [];
  const res = await fetch(`/api/flights/places?q=${encodeURIComponent(q)}`);
  const data = await res.json().catch(() => null);
  const rows: RawAirport[] = Array.isArray(data?.results) ? data.results : [];
  return rows.slice(0, 8).map((r) => ({
    code: r.code,
    label: r.city ? `${r.city} (${r.code})` : `${r.name ?? r.code} (${r.code})`,
    sub: [r.name, r.country].filter(Boolean).join(' · '),
  }));
}

export async function placesHotels(q: string): Promise<HotelPlace[]> {
  if (q.trim().length < 2) return [];
  const res = await fetch(`/api/hotels/places?q=${encodeURIComponent(q)}`);
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.results) ? data.results : [];
}

/* ---------------- flights ---------------- */

interface RawAirline {
  name: string;
  iataCode: string | null;
  logoSymbolUrl?: string | null;
}
interface RawSegment {
  originIata: string;
  destinationIata: string;
  departingAt: string;
  arrivingAt: string;
  durationMinutes: number | null;
  marketingCarrier?: RawAirline;
  flightNumber?: string | null;
  aircraft?: string | null;
}
interface RawSlice {
  originIata: string;
  destinationIata: string;
  departingAt: string;
  arrivingAt: string;
  durationMinutes: number | null;
  stops: number;
  segments?: RawSegment[];
}
interface RawFlightOffer {
  id: string;
  grandTotal: string;
  currency: string;
  cabinClass: string;
  owner: RawAirline;
  slices: RawSlice[];
  conditions?: {
    changeable?: boolean | null;
    refundable?: boolean | null;
    carryOn?: number | null;
    checked?: number | null;
  };
}

export interface FlightSearchArgs {
  origin: string; // IATA
  destination: string; // IATA
  departDate: string;
  returnDate?: string;
  cabinClass?: string;
  adults?: number;
}

function cabinLabel(c: string): string {
  return (
    { economy: 'Economy', premium_economy: 'Premium economy', business: 'Business', first: 'First' }[
      c
    ] ?? c
  );
}

export async function searchFlights(args: FlightSearchArgs): Promise<InventoryOption[]> {
  const res = await fetch('/api/flights/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Flight search failed.');

  const offers: RawFlightOffer[] = Array.isArray(data?.offers) ? data.offers : [];
  const roundTrip = Boolean(args.returnDate);

  return offers
    .map((o): InventoryOption | null => {
      const out = o.slices?.[0];
      if (!out) return null;
      const price = Math.ceil(Number(o.grandTotal));
      if (!Number.isFinite(price) || price <= 0) return null;
      const cabin = cabinLabel(o.cabinClass);
      // The card shows the marketing carrier of the first segment (matches the
      // consumer), falling back to the offer owner.
      const carrier = out.segments?.[0]?.marketingCarrier ?? o.owner;
      return {
        id: o.id,
        type: 'flight',
        title: `${out.originIata} → ${out.destinationIata}`,
        detail: `${roundTrip ? 'Round trip' : 'One way'} · ${cabin}`,
        // Flights carry no market/reference price from the provider, so we show
        // the true fare and claim no discount.
        marketPrice: price,
        price,
        cabin,
        carrier: carrier?.name,
        airline: carrier?.name,
        airlineIata: carrier?.iataCode ?? undefined,
        airlineLogo: carrier?.logoSymbolUrl ?? undefined,
        departAt: out.departingAt,
        arriveAt: out.arrivingAt,
        originIata: out.originIata,
        destIata: out.destinationIata,
        stops: out.stops,
        durationMins: out.durationMinutes ?? undefined,
        details: {
          kind: 'flight',
          cabin,
          conditions: o.conditions,
          slices: (o.slices ?? []).map((s) => ({
            originIata: s.originIata,
            destIata: s.destinationIata,
            durationMins: s.durationMinutes ?? undefined,
            stops: s.stops,
            segments: (s.segments ?? []).map((sg) => ({
              originIata: sg.originIata,
              destIata: sg.destinationIata,
              departAt: sg.departingAt,
              arriveAt: sg.arrivingAt,
              durationMins: sg.durationMinutes ?? undefined,
              carrier: sg.marketingCarrier?.name,
              carrierIata: sg.marketingCarrier?.iataCode ?? undefined,
              carrierLogo: sg.marketingCarrier?.logoSymbolUrl ?? undefined,
              flightNumber: sg.flightNumber ?? undefined,
              aircraft: sg.aircraft ?? undefined,
            })),
          })),
        },
      };
    })
    .filter((x): x is InventoryOption => x !== null);
}

/* ---------------- hotels ---------------- */

interface RawPaymentType {
  amount: string;
  show_amount?: string;
  competitive_price?: string;
  pay_at_property?: number;
}
interface RawRate {
  payment_options?: { payment_types?: RawPaymentType[] };
  average_nightly_rate?: string;
  free_cancellation?: boolean;
}
interface RawHotel {
  id: string;
  hid: string;
  hotelInfo: {
    name: string;
    star_rating: number;
    region?: { name?: string };
    address?: string;
    images?: string[];
    rating?: number;
    totalReviews?: number;
    amenity_groups?: { group_name?: string; amenities?: string[] }[];
  };
  rates?: RawRate[];
  competitor?: { lowest?: number; lowestSource?: string };
  no_availability?: boolean;
}

export interface HotelSearchArgs {
  regionId?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  hid?: number;
  checkin: string;
  checkout: string;
  adults?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}

export function nightsBetween(a: string, b: string): number {
  const n = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return n > 0 ? n : 1;
}

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Normalize a RateHawk image URL (swap the {size} token for a usable size). */
function hotelImg(u: string): string {
  return u.replace('{size}', '640x400');
}

/** Map raw supplier hotels into the InventoryOption shape the UI understands. */
export function mapHotels(
  hotels: RawHotel[],
  nights: number
): InventoryOption[] {
  return hotels
    .filter((h) => !h.no_availability)
    .map((h): InventoryOption | null => {
      const rate = h.rates?.[0];
      const pt = rate?.payment_options?.payment_types?.[0];
      const current = num(pt?.amount);
      if (!pt || current == null || current <= 0) return null;

      const pap = num(pt.pay_at_property) ?? 0;
      const allInCurrent = Math.ceil(current + pap);

      // Reference precedence mirrors the consumer HotelPricing: real competitor
      // lowest (already all-in) wins; otherwise competitive, then original —
      // each is room-only, so add pay-at-property. Only count it as a market
      // reference when it's strictly above what we charge.
      const competitorLowest = num(h.competitor?.lowest);
      const competitive = num(pt.competitive_price);
      const original = num(pt.show_amount);

      let marketPrice = allInCurrent;
      let competitorSource: string | undefined;
      if (competitorLowest != null && competitorLowest > allInCurrent) {
        marketPrice = Math.round(competitorLowest);
        competitorSource = h.competitor?.lowestSource;
      } else {
        const synthetic =
          competitive != null
            ? Math.ceil(competitive + pap)
            : original != null
              ? Math.ceil(original + pap)
              : undefined;
        if (synthetic != null && synthetic > allInCurrent) marketPrice = synthetic;
      }

      const images = (h.hotelInfo.images ?? []).slice(0, 15).map(hotelImg);
      const loc = h.hotelInfo.region?.name || h.hotelInfo.address || undefined;
      const amenities = Array.from(
        new Set(
          (h.hotelInfo.amenity_groups ?? []).flatMap((g) => g.amenities ?? [])
        )
      ).slice(0, 12);

      return {
        id: h.id || h.hid,
        hid: String(h.hid || h.id),
        type: 'hotel',
        title: h.hotelInfo.name,
        detail: `${nights} night${nights === 1 ? '' : 's'}`,
        marketPrice,
        price: allInCurrent,
        star: h.hotelInfo.star_rating || undefined,
        imageUrl: images[0],
        images,
        rating: num(h.hotelInfo.rating),
        reviews: num(h.hotelInfo.totalReviews),
        location: loc,
        nights,
        freeCancellation: rate?.free_cancellation,
        competitorSource,
        details: {
          kind: 'hotel',
          images,
          amenities,
          address: h.hotelInfo.address,
          rating: num(h.hotelInfo.rating),
          reviews: num(h.hotelInfo.totalReviews),
        },
      };
    })
    .filter((x): x is InventoryOption => x !== null);
}

export interface HotelPage {
  options: InventoryOption[];
  sessionId: string | null;
  hasMore: boolean;
}

/** Start a hotel search — first page plus the cursor for loading the rest. */
export async function startHotels(args: HotelSearchArgs): Promise<HotelPage> {
  const res = await fetch('/api/hotels/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Hotel search failed.');
  const nights = nightsBetween(args.checkin, args.checkout);
  return {
    options: mapHotels(Array.isArray(data?.hotels) ? data.hotels : [], nights),
    sessionId: data?.sessionId ?? null,
    hasMore: Boolean(data?.meta?.hasMore),
  };
}

/** Load the next page of an in-progress hotel search. */
export async function nextHotels(
  sessionId: string,
  pageSize: number,
  nights: number
): Promise<{ options: InventoryOption[]; hasMore: boolean }> {
  const res = await fetch('/api/hotels/next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, pageSize }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { options: [], hasMore: false };
  return {
    options: mapHotels(Array.isArray(data?.hotels) ? data.hotels : [], nights),
    hasMore: Boolean(data?.meta?.hasMore),
  };
}

/* ---------------- hotel detail ---------------- */

export interface HotelDetailRoom {
  name: string;
  meal?: string;
  refundable?: boolean;
  price?: number;
}
export interface HotelDetailData {
  name?: string;
  address?: string;
  star?: number;
  rating?: number;
  reviews?: number;
  lat?: number;
  lng?: number;
  images: string[];
  amenities: string[];
  amenityGroups: { group: string; items: string[] }[];
  about: string[];
  rooms: HotelDetailRoom[];
  noAvailability?: boolean;
}
export interface HotelReviewTheme {
  theme: string;
  sentiment?: string;
  summary?: string;
}
export interface HotelReviewSummary {
  rating?: number;
  guest_review_summary?: string;
  best_suited_for?: string[];
  review_themes?: HotelReviewTheme[];
  overall_booking_impression?: { recommendation?: string; summary?: string };
}

interface RawDetailImage {
  url?: string;
}
interface RawHotelDetail {
  hotel?: {
    name?: string;
    address?: string;
    region?: { name?: string };
    star_rating?: number;
    rating?: number;
    reviews_count?: number;
    location?: { lat?: number; lng?: number };
    images?: (string | RawDetailImage)[];
    amenities?: string[];
    allAmenities?: { group_name?: string; amenities?: string[] }[];
    about_property?: string[];
  };
  UIRooms?: unknown[];
  noAvailability?: boolean;
}

function parseRooms(raw: unknown[]): HotelDetailRoom[] {
  const rooms: HotelDetailRoom[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const rec = r as Record<string, unknown>;
    const name = String(rec.name || rec.roomName || rec.bedType || 'Room');
    const price =
      num(rec.price) ??
      num(rec.total) ??
      num((rec.rate as Record<string, unknown> | undefined)?.price);
    rooms.push({
      name,
      meal: typeof rec.meal === 'string' ? rec.meal : undefined,
      refundable:
        typeof rec.refundable === 'boolean' ? rec.refundable : undefined,
      price,
    });
    if (rooms.length >= 12) break;
  }
  return rooms;
}

export async function getHotelDetail(args: {
  hid: string;
  checkin: string;
  checkout: string;
  adults: number;
}): Promise<HotelDetailData> {
  const res = await fetch('/api/hotels/details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data: RawHotelDetail | null = await res.json().catch(() => null);
  if (!res.ok || !data?.hotel) throw new Error('Could not load this hotel.');
  const h = data.hotel;
  const images = (h.images ?? [])
    .map((i) => (typeof i === 'string' ? i : i?.url))
    .filter((u): u is string => Boolean(u))
    .map(hotelImg);
  return {
    name: h.name,
    address: h.address || h.region?.name,
    star: h.star_rating,
    rating: num(h.rating),
    reviews: num(h.reviews_count),
    lat: h.location?.lat,
    lng: h.location?.lng,
    images,
    amenities: Array.isArray(h.amenities) ? h.amenities : [],
    amenityGroups: (h.allAmenities ?? []).map((g) => ({
      group: g.group_name ?? '',
      items: g.amenities ?? [],
    })),
    about: Array.isArray(h.about_property) ? h.about_property : [],
    rooms: Array.isArray(data.UIRooms) ? parseRooms(data.UIRooms) : [],
    noAvailability: data.noAvailability,
  };
}

export async function getHotelDescription(hid: string): Promise<string[]> {
  const res = await fetch('/api/hotels/description', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hid: Number(hid) }),
  });
  const data = await res.json().catch(() => null);
  const paras = data?.description_paragraphs ?? data?.description;
  if (Array.isArray(paras)) return paras.filter((p) => typeof p === 'string');
  return typeof paras === 'string' ? [paras] : [];
}

export async function getHotelReviews(hid: string): Promise<HotelReviewSummary | null> {
  const res = await fetch('/api/hotels/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hid: Number(hid) }),
  });
  const data = await res.json().catch(() => null);
  if (!data || (!data.guest_review_summary && !data.review_themes)) return null;
  return data as HotelReviewSummary;
}
