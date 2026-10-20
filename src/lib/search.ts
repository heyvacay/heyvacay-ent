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
  regionId: number;
  label: string;
  sub: string;
  lat?: number;
  lng?: number;
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
        carrier: o.owner?.name,
        airline: o.owner?.name,
        airlineIata: o.owner?.iataCode ?? undefined,
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
  regionId: number;
  checkin: string;
  checkout: string;
  adults?: number;
}

function nightsBetween(a: string, b: string): number {
  const n = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
  return n > 0 ? n : 1;
}

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export async function searchHotels(args: HotelSearchArgs): Promise<InventoryOption[]> {
  const res = await fetch('/api/hotels/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Hotel search failed.');

  const hotels: RawHotel[] = Array.isArray(data?.hotels) ? data.hotels : [];
  const nights = nightsBetween(args.checkin, args.checkout);

  return hotels
    .filter((h) => !h.no_availability)
    .map((h): InventoryOption | null => {
      const pt = h.rates?.[0]?.payment_options?.payment_types?.[0];
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
      if (competitorLowest != null && competitorLowest > allInCurrent) {
        marketPrice = Math.round(competitorLowest);
      } else {
        const synthetic =
          competitive != null ? Math.ceil(competitive + pap) : original != null ? Math.ceil(original + pap) : undefined;
        if (synthetic != null && synthetic > allInCurrent) marketPrice = synthetic;
      }

      const images = (h.hotelInfo.images ?? [])
        .slice(0, 6)
        .map((i) => i.replace('{size}', '640x400'));
      const loc = h.hotelInfo.region?.name || h.hotelInfo.address || undefined;
      const amenities = Array.from(
        new Set(
          (h.hotelInfo.amenity_groups ?? []).flatMap((g) => g.amenities ?? [])
        )
      ).slice(0, 12);

      return {
        id: h.id || h.hid,
        type: 'hotel',
        title: h.hotelInfo.name,
        detail: `${nights} night${nights === 1 ? '' : 's'}`,
        marketPrice,
        price: allInCurrent,
        star: h.hotelInfo.star_rating || undefined,
        imageUrl: images[0],
        rating: num(h.hotelInfo.rating),
        reviews: num(h.hotelInfo.totalReviews),
        location: loc,
        nights,
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
