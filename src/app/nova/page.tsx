'use client';

import { useMemo, useState } from 'react';
import {
  useNovaBookings,
  statusConfig,
  currencySymbol,
  CANCELLATION_REASONS,
  type NovaBooking,
  type BookingStatus,
  type CancellationReason,
} from '@/lib/novaBookings';
import { money, shortDate } from '@/lib/format';

/**
 * Nova — internal booking management. Full control over every enterprise
 * booking across all accounts: search & filter, inspect the complete record,
 * action special requests, and cancel with a logged reason — the same
 * surface and information as HeyVacay.co's admin panel.
 */

type View = 'bookings' | 'special_requests';

const STATUS_OPTIONS: BookingStatus[] = [
  'pending_prebook',
  'pending_form',
  'processing',
  'confirmed',
  'modified',
  'cancelled',
  'failed',
];

/** Status pill colours for the dark Nova theme. */
const PILL: Record<string, string> = {
  green: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
  amber: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
  slate: 'bg-slate-400/10 text-slate-300 ring-slate-400/20',
  brand: 'bg-brand/10 text-brand ring-brand/25',
  red: 'bg-red-400/10 text-red-300 ring-red-400/20',
};

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${PILL[color] ?? PILL.slate}`}
    >
      {children}
    </span>
  );
}

export default function NovaSupport() {
  const { bookings, cancelBooking, toggleRequestCompleted } = useNovaBookings();
  const [view, setView] = useState<View>('bookings');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | BookingStatus>('all');
  const [company, setCompany] = useState<'all' | string>('all');
  const [detail, setDetail] = useState<NovaBooking | null>(null);
  const [cancelling, setCancelling] = useState<NovaBooking | null>(null);
  const [requestDetail, setRequestDetail] = useState<NovaBooking | null>(null);

  const companies = useMemo(
    () => Array.from(new Set(bookings.map((b) => b.companyName))).sort(),
    [bookings]
  );

  const stats = useMemo(() => {
    const confirmed = bookings.filter((b) => b.status === 'confirmed' || b.status === 'modified');
    return {
      total: bookings.length,
      confirmed: confirmed.length,
      commission: confirmed.reduce((s, b) => s + b.commissionAmount, 0),
      revenue: confirmed.reduce((s, b) => s + b.totalAmount, 0),
      openRequests: bookings.filter((b) => b.userRequest && !b.userRequestCompleted).length,
    };
  }, [bookings]);

  const query = q.trim().toLowerCase();
  const rows = bookings
    .filter((b) => (view === 'special_requests' ? !!b.userRequest : true))
    .filter((b) => (status === 'all' ? true : b.status === status))
    .filter((b) => (company === 'all' ? true : b.companyName === company))
    .filter((b) =>
      query
        ? [b.bookingRef, b.partnerOrderId, b.hotelName, b.userName, b.userEmail, b.companyName, b.ratehawkOrderId]
            .filter(Boolean)
            .some((f) => f!.toLowerCase().includes(query))
        : true
    );

  const clearable = q || status !== 'all' || company !== 'all';
  const inputCls =
    'rounded-lg border border-line bg-navy px-3 py-2.5 text-sm text-white outline-none placeholder:text-muted focus:border-brand';

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Bookings</h1>
      <p className="mt-1 text-sm text-muted">
        Manage every enterprise booking across all accounts — inspect, action special requests, and
        cancel with a logged reason.
      </p>

      {/* stats */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total bookings" value={String(stats.total)} />
        <Stat label="Confirmed" value={String(stats.confirmed)} />
        <Stat label="Commission (confirmed)" value={money(stats.commission)} tone="brand" />
        <Stat label="Open requests" value={String(stats.openRequests)} tone="amber" />
      </div>

      {/* tabs */}
      <div className="mt-6 inline-flex gap-1 rounded-lg border border-line bg-navy p-1">
        {(
          [
            ['bookings', 'All bookings'],
            ['special_requests', `Special requests${stats.openRequests ? ` (${stats.openRequests})` : ''}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              view === key ? 'bg-brand text-navy-deep' : 'text-muted hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ref, hotel, guest, RateHawk ID…"
          className={`min-w-0 flex-1 ${inputCls}`}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | BookingStatus)}
          className={inputCls}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusConfig(s).label}
            </option>
          ))}
        </select>
        <select value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls}>
          <option value="all">All companies</option>
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {clearable && (
          <button
            onClick={() => {
              setQ('');
              setStatus('all');
              setCompany('all');
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* table */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-navy">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                {view === 'special_requests' ? (
                  <>
                    <Th>Booking Ref</Th>
                    <Th>Guest / Company</Th>
                    <Th>RateHawk Order ID</Th>
                    <Th>Special Request</Th>
                    <Th>Status</Th>
                  </>
                ) : (
                  <>
                    <Th>Booking ID</Th>
                    <Th>Hotel</Th>
                    <Th>Guest</Th>
                    <Th>Check-in</Th>
                    <Th>Nights</Th>
                    <Th>Net</Th>
                    <Th>Commission</Th>
                    <Th>Total</Th>
                    <Th>Promo</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                  </>
                )}
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-muted">
                    No bookings match.
                  </td>
                </tr>
              )}
              {rows.map((b) => {
                const cfg = statusConfig(b.status);
                const sym = currencySymbol(b.currency);
                const dim = cfg.isFinancialDimmed ? 'text-muted' : 'text-white';
                const strike = cfg.hasFinancialLineThrough ? 'line-through' : '';
                return (
                  <tr
                    key={b.id}
                    className="cursor-pointer border-b border-line/50 last:border-0 hover:bg-white/5"
                    onClick={() => setDetail(b)}
                  >
                    {view === 'special_requests' ? (
                      <>
                        <Td className="font-medium text-white">#{b.bookingRef}</Td>
                        <Td>
                          <p className="font-medium text-white">{b.userName}</p>
                          <p className="text-xs text-muted">{b.companyName}</p>
                        </Td>
                        <Td className="font-mono text-xs text-muted">{b.ratehawkOrderId}</Td>
                        <Td className="max-w-xs">
                          <button
                            className="truncate text-left text-mist hover:text-white hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRequestDetail(b);
                            }}
                          >
                            {b.userRequest}
                          </button>
                        </Td>
                        <Td>
                          <Pill color={b.userRequestCompleted ? 'green' : 'amber'}>
                            {b.userRequestCompleted ? 'Completed' : 'Pending Action'}
                          </Pill>
                        </Td>
                      </>
                    ) : (
                      <>
                        <Td className="font-medium text-white">#{b.bookingRef}</Td>
                        <Td>
                          <p className="font-medium text-white">{b.hotelName}</p>
                          <p className="text-xs text-muted">{b.regionName}</p>
                        </Td>
                        <Td>
                          <p className="font-medium text-white">{b.userName}</p>
                          <p className="text-xs text-muted">{b.userEmail}</p>
                        </Td>
                        <Td className="whitespace-nowrap text-mist">{shortDate(b.checkinDate)}</Td>
                        <Td className="text-mist">{b.nights}</Td>
                        <Td className={`whitespace-nowrap font-medium ${dim} ${strike}`}>
                          {cfg.canShowCommission ? `${sym}${b.netAmount.toFixed(2)}` : '—'}
                        </Td>
                        <Td className={`whitespace-nowrap font-medium ${dim} ${strike}`}>
                          {cfg.canShowCommission
                            ? `${sym}${b.commissionAmount.toFixed(2)} (${b.commissionPercent.toFixed(0)}%)`
                            : '—'}
                        </Td>
                        <Td className="whitespace-nowrap font-medium text-white">
                          {sym}
                          {b.totalAmount.toFixed(2)}
                        </Td>
                        <Td>
                          {b.promoCode ? (
                            <span className="inline-flex items-center rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium uppercase text-mist">
                              {b.promoCode}
                            </span>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td>
                          <Pill color={cfg.color}>{cfg.label}</Pill>
                        </Td>
                        <Td className="whitespace-nowrap text-muted">{shortDate(b.createdAt)}</Td>
                      </>
                    )}
                    <Td className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {view === 'special_requests' && (
                          <button
                            onClick={() => toggleRequestCompleted(b.id, !b.userRequestCompleted)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                              b.userRequestCompleted
                                ? 'border border-line text-mist hover:bg-white/5'
                                : 'bg-emerald-500 text-white hover:brightness-110'
                            }`}
                          >
                            {b.userRequestCompleted ? 'Mark incomplete' : 'Mark complete'}
                          </button>
                        )}
                        <button
                          onClick={() => setDetail(b)}
                          className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-mist hover:bg-white/5"
                        >
                          View
                        </button>
                        {view !== 'special_requests' && cfg.canCancel && (
                          <button
                            onClick={() => setCancelling(b)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-400/10"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Cross-account management is live here. Actions persist locally in this demo; they write to
        the ent.nova backend (RateHawk order sync + refund log) once it is connected.
      </p>

      {detail && (
        <BookingDrawer
          booking={detail}
          onClose={() => setDetail(null)}
          onCancel={() => {
            setCancelling(detail);
            setDetail(null);
          }}
        />
      )}
      {cancelling && (
        <CancelDialog
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onConfirm={(reason, comment) => {
            cancelBooking(cancelling.id, reason, comment);
            setCancelling(null);
          }}
        />
      )}
      {requestDetail && (
        <RequestDialog
          booking={requestDetail}
          onClose={() => setRequestDetail(null)}
          onToggle={() => {
            toggleRequestCompleted(requestDetail.id, !requestDetail.userRequestCompleted);
            setRequestDetail(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- bits ---------------- */

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'brand' | 'amber' }) {
  const color = tone === 'brand' ? 'text-brand' : tone === 'amber' ? 'text-amber-300' : 'text-white';
  return (
    <div className="rounded-2xl border border-line bg-navy p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

/* ---------------- detail drawer ---------------- */

function BookingDrawer({
  booking: b,
  onClose,
  onCancel,
}: {
  booking: NovaBooking;
  onClose: () => void;
  onCancel: () => void;
}) {
  const cfg = statusConfig(b.status);
  const sym = currencySymbol(b.currency);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-auto border-l border-line bg-navy text-mist shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-display text-lg font-bold text-white">#{b.bookingRef}</p>
            <p className="text-sm text-muted">{b.companyName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Pill color={cfg.color}>{cfg.label}</Pill>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg px-2 py-1 text-muted hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-4 text-sm">
          <Section title="Stay">
            <KV k="Hotel" v={b.hotelName} />
            <KV k="Location" v={b.regionName} />
            <KV k="Check-in" v={shortDate(b.checkinDate)} />
            <KV k="Check-out" v={shortDate(b.checkoutDate)} />
            <KV k="Nights" v={String(b.nights)} />
            <KV
              k="Rooms"
              v={`${b.rooms} · ${b.adults} adults${b.children ? `, ${b.children} children` : ''}`}
            />
          </Section>
          <Section title="Guest">
            <KV k="Name" v={b.userName} />
            <KV k="Email" v={b.contactEmail} />
            <KV k="Phone" v={b.contactPhone} />
          </Section>
          <Section title="Financials">
            <KV k="Net amount" v={`${sym}${b.netAmount.toFixed(2)}`} />
            <KV
              k="Commission"
              v={`${sym}${b.commissionAmount.toFixed(2)} (${b.commissionPercent.toFixed(0)}%)`}
            />
            {b.promoCode && <KV k="Promo" v={b.promoCode} />}
            <KV k="Total charged" v={`${sym}${b.totalAmount.toFixed(2)}`} />
            {cfg.showRefundDetails && b.refundStatus && (
              <>
                <KV k="Refund status" v={b.refundStatus} />
                {b.refundAmount != null && <KV k="Refund amount" v={`${sym}${b.refundAmount.toFixed(2)}`} />}
              </>
            )}
          </Section>
          <Section title="References">
            <KV k="Booking ref" v={b.bookingRef} mono />
            <KV k="Partner order ID" v={b.partnerOrderId} mono />
            <KV k="RateHawk order ID" v={b.ratehawkOrderId} mono />
            <KV k="Created" v={shortDate(b.createdAt)} />
          </Section>
          {b.userRequest && (
            <Section title="Special request">
              <p className="text-mist">{b.userRequest}</p>
              <p className="mt-1">
                <Pill color={b.userRequestCompleted ? 'green' : 'amber'}>
                  {b.userRequestCompleted ? 'Completed' : 'Pending Action'}
                </Pill>
              </p>
            </Section>
          )}
          {b.status === 'cancelled' && b.cancellationReason && (
            <Section title="Cancellation">
              <KV
                k="Reason"
                v={
                  CANCELLATION_REASONS.find((r) => r.value === b.cancellationReason)?.label ??
                  b.cancellationReason
                }
              />
              {b.cancellationComment && <KV k="Comment" v={b.cancellationComment} />}
              {b.cancelledAt && <KV k="Cancelled" v={shortDate(b.cancelledAt)} />}
            </Section>
          )}
        </div>

        {cfg.canCancel && (
          <div className="mt-auto border-t border-line px-5 py-4">
            <button
              onClick={onCancel}
              className="w-full rounded-lg border border-red-400/30 bg-red-400/10 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-400/20"
            >
              Cancel this booking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="space-y-1.5 rounded-xl border border-line bg-navy-deep p-3">{children}</div>
    </div>
  );
}
function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted">{k}</span>
      <span className={`text-right font-medium text-white ${mono ? 'font-mono text-xs' : ''}`}>{v}</span>
    </div>
  );
}

/* ---------------- cancel dialog ---------------- */

function CancelDialog({
  booking: b,
  onClose,
  onConfirm,
}: {
  booking: NovaBooking;
  onClose: () => void;
  onConfirm: (reason: CancellationReason, comment?: string) => void;
}) {
  const [reason, setReason] = useState<CancellationReason>('user_request');
  const [comment, setComment] = useState('');
  const inputCls =
    'w-full rounded-lg border border-line bg-navy-deep px-3 py-2.5 text-sm text-white outline-none placeholder:text-muted focus:border-brand';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-navy p-5 text-mist shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold text-white">Cancel booking</h2>
        <p className="mt-1 text-sm text-muted">
          Are you sure you want to cancel this booking? This action cannot be undone.
        </p>
        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
          <p className="text-sm font-medium text-amber-200">#{b.bookingRef}</p>
          <p className="mt-0.5 text-sm text-amber-100/80">
            {b.hotelName} — {b.userName}
          </p>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-mist">Cancellation reason *</label>
          <select value={reason} onChange={(e) => setReason(e.target.value as CancellationReason)} className={inputCls}>
            {CANCELLATION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-medium text-mist">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Add additional details…"
            className={inputCls}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-white">
            Keep booking
          </button>
          <button
            onClick={() => onConfirm(reason, comment || undefined)}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Confirm cancellation
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- special-request dialog ---------------- */

function RequestDialog({
  booking: b,
  onClose,
  onToggle,
}: {
  booking: NovaBooking;
  onClose: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-navy p-5 text-mist shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-white">Special request</h2>
          <Pill color={b.userRequestCompleted ? 'green' : 'amber'}>
            {b.userRequestCompleted ? 'Completed' : 'Pending Action'}
          </Pill>
        </div>
        <p className="mt-1 text-sm text-muted">
          Booking <span className="font-semibold text-mist">#{b.bookingRef}</span> · {b.userName}
        </p>
        <p className="mt-4 rounded-lg border border-line bg-navy-deep p-3 text-sm text-mist">{b.userRequest}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-white">
            Close
          </button>
          <button
            onClick={onToggle}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              b.userRequestCompleted
                ? 'border border-line text-mist hover:bg-white/5'
                : 'bg-brand text-navy-deep hover:brightness-110'
            }`}
          >
            {b.userRequestCompleted ? 'Mark incomplete' : 'Mark complete'}
          </button>
        </div>
      </div>
    </div>
  );
}
