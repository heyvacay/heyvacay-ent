import { NextResponse } from 'next/server';
import { OPENTABLE } from '@/lib/config.server';
import { getRestaurantDetails } from '@/lib/opentable.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rich restaurant detail — menus, experiences, reviews and the review-rating
 * summary — from OpenTable's Online Booking / Consumer API. When OpenTable
 * isn't configured, returns empty collections so the UI degrades gracefully.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ rid: string }> }
) {
  const { rid } = await params;
  if (!rid) {
    return NextResponse.json({ error: 'rid is required.' }, { status: 400 });
  }
  if (!OPENTABLE.live) {
    return NextResponse.json({
      rid,
      live: false,
      menus: [],
      experiences: [],
      reviews: [],
      reviewSummary: null,
    });
  }
  const details = await getRestaurantDetails(rid);
  return NextResponse.json({ ...details, live: true });
}
