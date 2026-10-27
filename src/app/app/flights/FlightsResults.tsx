'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { searchFlights } from '@/lib/search';
import { getSeatMap, type SeatRow } from '@/lib/seatmap';
import type { InventoryOption, FlightDetails } from '@/lib/types';
import { rewardsFor } from '@/lib/rewards';
import {
  Button,
  Card,
  Select,
  Field,
  EmptyState,
  cn,
} from '@/components/app/ui';
import { money, num, dateRange } from '@/lib/format';
import { Plane, Check, Shield, Gift, Wallet } from '@/components/icons';
import { HvLoader } from '@/components/HvLoader';

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
function layover(aIso: string, bIso: string): string {
  const m = Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000);
  return Number.isFinite(m) && m > 0 ? durLabel(m) : '';
}

function AirlineBadge({ iata, logo }: { iata?: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
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

function Signals({
  inPolicy,
  needsApproval,
  points,
}: {
  inPolicy: boolean;
  needsApproval: boolean;
  points: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {inPolicy ? (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" /> In policy
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
          <Shield className="h-3.5 w-3.5" /> {needsApproval ? 'Needs approval' : 'Policy note'}
        </span>
      )}
      <span className="inline-flex items-center gap-1 font-semibold text-brand-dark">
        <Gift className="h-3.5 w-3.5" /> +{num(points)} pts
      </span>
    </div>
  );
}

function SliceRow({
  depart,
  arrive,
  origin,
  dest,
  mins,
  stops,
}: {
  depart?: string;
  arrive?: string;
  origin?: string;
  dest?: string;
  mins?: number;
  stops?: number;
}) {
  return (
    <div className="flex flex-1 items-center gap-4">
      <div className="text-right">
        <div className="text-lg font-semibold text-slate-900">{fmtTime(depart)}</div>
        <div className="text-xs text-slate-400">{origin}</div>
      </div>
      <div className="flex flex-1 flex-col items-center">
        <div className="text-xs text-slate-400">{durLabel(mins)}</div>
        <div className="my-1 flex w-full items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full border border-slate-400" />
          <span className="h-px flex-1 bg-slate-200" />
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px]',
              !stops ? 'border-brand text-brand-dark' : 'border-slate-300 text-slate-400'
            )}
          >
            {stopsLabel(stops)}
          </span>
          <span className="h-px flex-1 bg-slate-200" />
          <Plane className="h-3 w-3 rotate-90 text-slate-400" />
        </div>
      </div>
      <div className="text-left">
        <div className="text-lg font-semibold text-slate-900">{fmtTime(arrive)}</div>
        <div className="text-xs text-slate-400">{dest}</div>
      </div>
    </div>
  );
}

/* ---------------- details modal ---------------- */

function DetailsModal({ opt, onClose }: { opt: InventoryOption; onClose: () => void }) {
  const d = opt.details?.kind === 'flight' ? (opt.details as FlightDetails) : null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">{opt.title}</h2>
            <p className="text-xs text-slate-400">{opt.detail}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <div className="space-y-5 px-5 py-4">
          {d?.slices.map((slice, si) => (
            <div key={si}>
              <p className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>
                  {d.slices.length > 1 ? (si === 0 ? 'Outbound' : 'Return') : 'Itinerary'} ·{' '}
                  {slice.originIata} → {slice.destIata}
                </span>
                <span className="text-xs font-normal text-slate-400">
                  {durLabel(slice.durationMins)} · {stopsLabel(slice.stops)}
                </span>
              </p>
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
                        <span className="text-xs text-slate-400">{durLabel(sg.durationMins)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-sm">
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">{fmtTime(sg.departAt)}</div>
                          <div className="text-xs text-slate-400">{sg.originIata}</div>
                        </div>
                        <div className="flex-1 border-t border-dashed border-slate-200" />
                        <div className="text-left">
                          <div className="font-semibold text-slate-900">{fmtTime(sg.arriveAt)}</div>
                          <div className="text-xs text-slate-400">{sg.destIata}</div>
                        </div>
                      </div>
                      {sg.aircraft && <p className="mt-1 text-xs text-slate-400">{sg.aircraft}</p>}
                    </div>
                    {gi < slice.segments.length - 1 && (
                      <p className="py-1 pl-3 text-xs font-medium text-amber-600">
                        Layover {layover(sg.arriveAt, slice.segments[gi + 1].departAt)} in {sg.destIata}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {d?.cabin && (
            <p className="text-xs text-slate-500">
              Cabin: <span className="font-medium text-slate-700">{d.cabin}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function FlightsResults() {
  const params = useSearchParams();
  const { state, role, activeUser, evaluatePolicies, book, spentForScope } = useStore();
  const canBookForOthers = role === 'admin' || role === 'booker';

  const origin = params.get('origin') || '';
  const destination = params.get('destination') || '';
  const departDate = params.get('depart') || '';
  const returnDate = params.get('return') || undefined;
  const cabin = params.get('cabin') || 'economy';
  const eventId = params.get('eventId') || undefined;
  const eventName = params.get('eventName') || undefined;

  const [results, setResults] = useState<InventoryOption[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpt, setDetailOpt] = useState<InventoryOption | null>(null);
  const [selected, setSelected] = useState<InventoryOption | null>(null);
  const [travelerId, setTravelerId] = useState(params.get('travelerId') || activeUser.id);
  const [confirmed, setConfirmed] = useState<{ opt: InventoryOption; pending: boolean } | null>(null);

  useEffect(() => {
    if (!origin || !destination || !departDate) {
      setError('Missing search details.');
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    searchFlights({ origin, destination, departDate, returnDate, cabinClass: cabin, adults: 1 })
      .then((r) => live && (setResults(r), setLoading(false)))
      .catch((e) => live && (setError(e instanceof Error ? e.message : 'Search failed.'), setLoading(false)));
    return () => {
      live = false;
    };
  }, [origin, destination, departDate, returnDate, cabin]);

  const sig = (opt: InventoryOption) => {
    const flags = evaluatePolicies(opt, departDate);
    const { points } = rewardsFor(opt);
    const needsApproval = flags.some((f) => f.policy.action === 'approve' || f.policy.action === 'block');
    return { flags, points, needsApproval };
  };

  const confirm = (
    opt: InventoryOption,
    extra = 0,
    fareLabel = '',
    seat: string | null = null
  ) => {
    const finalOpt: InventoryOption = {
      ...opt,
      price: opt.price + extra,
      detail: `${opt.detail}${fareLabel ? ` · ${fareLabel}` : ''}${seat ? ` · Seat ${seat}` : ''}`,
    };
    const { needsApproval } = sig(finalOpt);
    book({
      opt: finalOpt,
      travelerId,
      startDate: departDate,
      endDate: returnDate || departDate,
      eventId,
      eventName,
    });
    setConfirmed({ opt: finalOpt, pending: needsApproval });
    setSelected(null);
  };

  if (confirmed) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <Check className="h-7 w-7" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">
          {confirmed.pending ? 'Sent for approval' : 'Flight confirmed'}
        </h2>
        <p className="mt-1 text-slate-500">{confirmed.opt.title} · {confirmed.opt.detail}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button href="/app/trips">View my trips</Button>
          <Button href="/app/book" variant="outline">Book another</Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <Link href="/app/book" className="text-sm font-medium text-brand-dark hover:underline">
          ← Edit search
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
          {origin} → {destination}
        </h1>
        <p className="text-sm text-slate-400">
          {departDate}
          {returnDate ? ` – ${returnDate}` : ''} · {cabin.replace('_', ' ')}
          {!loading && results ? ` · ${results.length} fares` : ''}
        </p>
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-700">{error}</p>
        </Card>
      )}

      {loading && <HvLoader className="py-24" />}

      {!loading && results && results.length === 0 && !error && (
        <EmptyState title="No fares for those dates" sub="Try different dates or nearby airports." />
      )}

      {!loading && results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((opt) => {
            const { flags, points, needsApproval } = sig(opt);
            return (
              <Card key={opt.id} className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3 sm:w-44">
                    <AirlineBadge iata={opt.airlineIata} logo={opt.airlineLogo} />
                    <span className="text-sm font-medium text-slate-800">{opt.airline}</span>
                  </div>
                  <SliceRow
                    depart={opt.departAt}
                    arrive={opt.arriveAt}
                    origin={opt.originIata}
                    dest={opt.destIata}
                    mins={opt.durationMins}
                    stops={opt.stops}
                  />
                  <div className="flex flex-col items-end gap-1 sm:w-44">
                    <span className="text-xl font-bold text-slate-900">{money(opt.price)}</span>
                    <Button size="sm" className="mt-1 w-full" onClick={() => setSelected(opt)}>
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
                  <Signals inPolicy={flags.length === 0} needsApproval={needsApproval} points={points} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {detailOpt && <DetailsModal opt={detailOpt} onClose={() => setDetailOpt(null)} />}

      {/* checkout / review */}
      {selected && (
        <CheckoutPanel
          opt={selected}
          onClose={() => setSelected(null)}
          onConfirm={(extra, fareLabel, seat) => confirm(selected, extra, fareLabel, seat)}
          sig={sig}
          canBookForOthers={canBookForOthers}
          travelerId={travelerId}
          setTravelerId={setTravelerId}
          users={state.users.filter((u) => u.status === 'active')}
          spent={spentForScope('employee', travelerId)}
          budget={state.budgets.find((b) => b.scope === 'employee' && b.refId === travelerId)?.limit}
        />
      )}
    </div>
  );
}

/* ---------------- checkout panel ---------------- */

// Fare families. Deltas are indicative in the prototype; wire to the airline's
// branded fares / offer services when the backend exposes them per offer.
const FARES = [
  { label: 'Basic', delta: 0, note: 'Carry-on only · no changes · no seat choice' },
  { label: 'Main', delta: 45, note: 'Seat choice + 1 checked bag' },
  { label: 'Flex', delta: 120, note: 'Free changes + fully refundable' },
];

/** Real seat map from Duffel (via /api/flights/seatmap), with a mock fallback. */
function SeatMap({
  offerId,
  selected,
  onSelect,
}: {
  offerId: string;
  selected: string | null;
  onSelect: (designator: string, amount: number) => void;
}) {
  const [rows, setRows] = useState<SeatRow[] | null>(null);

  useEffect(() => {
    let live = true;
    getSeatMap(offerId).then((r) => live && setRows(r.rows));
    return () => {
      live = false;
    };
  }, [offerId]);

  if (!rows) {
    return (
      <div className="grid place-items-center rounded-xl border border-slate-200 py-6 text-xs text-slate-400">
        Loading seat map…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-400">
        No seat map available for this flight.
      </p>
    );
  }

  // Columns from the widest row, split into two halves around the aisle.
  const maxCols = Math.max(...rows.map((r) => r.seats.length));
  const aisleAt = Math.ceil(maxCols / 2);

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Front of cabin
      </p>
      <div className="max-h-56 space-y-1.5 overflow-auto">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-center gap-1.5">
            <span className="w-5 text-right text-[10px] text-slate-400">{row.label}</span>
            {row.seats.map((s, i) => {
              const isSel = selected === s.designator;
              return (
                <span key={s.designator} className="flex items-center">
                  {i === aisleAt && <span className="w-3" />}
                  <button
                    type="button"
                    disabled={!s.available}
                    onClick={() => onSelect(s.designator, s.amount ?? 0)}
                    title={s.available && s.amount ? `${s.designator} · $${s.amount}` : s.designator}
                    aria-label={`Seat ${s.designator}`}
                    className={`h-6 w-6 rounded text-[9px] font-semibold ${
                      !s.available
                        ? 'cursor-not-allowed bg-slate-100 text-slate-300'
                        : isSel
                          ? 'bg-brand text-navy-deep'
                          : 'bg-brand/15 text-brand-dark hover:bg-brand/30'
                    }`}
                  >
                    {s.column}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckoutPanel({
  opt,
  onClose,
  onConfirm,
  sig,
  canBookForOthers,
  travelerId,
  setTravelerId,
  users,
  spent,
  budget,
}: {
  opt: InventoryOption;
  onClose: () => void;
  onConfirm: (extra: number, fareLabel: string, seat: string | null) => void;
  sig: (o: InventoryOption) => { flags: ReturnType<typeof Object>[]; points: number; needsApproval: boolean };
  canBookForOthers: boolean;
  travelerId: string;
  setTravelerId: (id: string) => void;
  users: { id: string; name: string }[];
  spent: number;
  budget?: number;
}) {
  const { flags, points, needsApproval } = sig(opt);
  const [fareIdx, setFareIdx] = useState(1);
  const [seat, setSeat] = useState<string | null>(null);
  const [seatFee, setSeatFee] = useState(0);
  const fare = FARES[fareIdx];
  const total = opt.price + fare.delta + seatFee;
  const overBudget = budget != null ? spent + total > budget : false;
  const seatAllowed = fareIdx >= 1; // Basic has no seat selection
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-slate-900">Review &amp; book</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="font-semibold text-slate-800">{opt.title}</p>
            <p className="text-sm text-slate-400">{opt.detail}</p>
          </div>

          {canBookForOthers && (
            <Field label="Traveler">
              <Select value={travelerId} onChange={(e) => setTravelerId(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </Field>
          )}

          {/* fare type */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Fare type</p>
            <div className="space-y-2">
              {FARES.map((f, i) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => {
                    setFareIdx(i);
                    if (i < 1) {
                      setSeat(null);
                      setSeatFee(0);
                    }
                  }}
                  className={`flex w-full items-start justify-between gap-2 rounded-xl border p-3 text-left transition ${
                    fareIdx === i ? 'border-brand bg-brand/5' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">{f.label}</span>
                    <span className="block text-xs text-slate-400">{f.note}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-slate-700">
                    {f.delta === 0 ? 'Included' : `+${money(f.delta)}`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* seat selection */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Seat {seat ? <span className="text-brand-dark">· {seat}</span> : ''}
            </p>
            {seatAllowed ? (
              <SeatMap
                offerId={opt.id}
                selected={seat}
                onSelect={(d, amt) => {
                  setSeat(d);
                  setSeatFee(amt);
                }}
              />
            ) : (
              <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-400">
                Seat selection is available on Main and Flex fares.
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Base fare</span>
              <span className="text-slate-700">{money(opt.price)}</span>
            </div>
            {fare.delta > 0 && (
              <div className="mt-1 flex justify-between">
                <span className="text-slate-500">{fare.label} fare</span>
                <span className="text-slate-700">+{money(fare.delta)}</span>
              </div>
            )}
            {seat && seatFee > 0 && (
              <div className="mt-1 flex justify-between">
                <span className="text-slate-500">Seat {seat}</span>
                <span className="text-slate-700">+{money(seatFee)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1">
              <span className="text-slate-500">Total</span>
              <span className="font-semibold text-slate-900">{money(total)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-slate-500">Points earned</span>
              <span className="font-semibold text-brand-dark">+{num(points)}</span>
            </div>
          </div>

          {flags.length > 0 && (
            <div className="space-y-1.5">
              {(flags as { message?: string }[]).map((f, i) => (
                <p key={i} className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> {f.message}
                </p>
              ))}
            </div>
          )}

          {overBudget && budget != null && (
            <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> This puts the traveler over their {money(budget)} budget.
            </p>
          )}

          <Button className="w-full" onClick={() => onConfirm(fare.delta + seatFee, fare.label, seat)}>
            {needsApproval ? 'Request this flight' : 'Confirm booking'}
          </Button>
          {needsApproval && (
            <p className="text-center text-[11px] text-slate-400">
              Routes to an admin for approval — fare re-priced at ticketing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
