'use client';

import { useState } from 'react';
import { useWorkspace } from '@/lib/appLink';
import { companyAccountNumber, userNumber } from '@/components/app/AppShell';
import { money, shortDate } from '@/lib/format';

/**
 * Nova — internal support console. Our support team looks up bookings made by
 * enterprise customers here, searchable by company account number, user
 * number, traveler, or trip. Reads the live customer workspace today; becomes
 * a server read across all accounts when ent.nova is live.
 */
export default function NovaSupport() {
  const ws = useWorkspace();
  const [q, setQ] = useState('');

  const acct = ws ? companyAccountNumber(ws.company.id) : '';

  const rows = (ws?.bookings ?? []).map((b) => {
    const user = ws?.users.find((u) => u.id === b.travelerId);
    return {
      b,
      user,
      userNo: ws && user ? userNumber(ws.company.id, user.id) : '',
    };
  });

  const query = q.trim().toLowerCase();
  const filtered = rows.filter(({ b, user, userNo }) => {
    if (!query) return true;
    return [b.title, b.destination, b.status, user?.name, user?.email, userNo, acct, ws?.company.name]
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(query));
  });

  const gmv = filtered.reduce((s, r) => s + (r.b.price || 0), 0);
  const saved = filtered.reduce((s, r) => s + (r.b.savings || 0), 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white">Booking lookup</h1>
      <p className="mt-1 text-sm text-muted">
        Search every enterprise booking by company account number, user number, traveler, or trip.
      </p>

      {!ws ? (
        <div className="mt-6 rounded-2xl border border-line bg-navy p-8 text-center text-muted">
          No customer workspace detected in this browser. Open a customer account from the Sales
          console (Enter account) to load its bookings here.
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search account #, user #, traveler, trip…"
              className="min-w-0 flex-1 rounded-lg border border-line bg-navy px-3 py-2.5 text-sm text-white outline-none placeholder:text-muted focus:border-brand"
            />
            <span className="rounded-full border border-line bg-navy px-3 py-1.5 text-xs text-muted">
              {ws.company.name} · {acct}
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Stat label="Bookings" value={String(filtered.length)} />
            <Stat label="Booking value" value={money(gmv)} />
            <Stat label="Saved vs market" value={money(saved)} tone="brand" />
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-navy">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-3 font-semibold">Traveler</th>
                    <th className="px-4 py-3 font-semibold">User #</th>
                    <th className="px-4 py-3 font-semibold">Trip</th>
                    <th className="px-4 py-3 font-semibold">Dates</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted">
                        No bookings match.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(({ b, user, userNo }) => (
                      <tr key={b.id} className="border-b border-line/50 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{user?.name ?? '—'}</p>
                          <p className="text-xs text-muted">{user?.email}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{userNo}</td>
                        <td className="px-4 py-3">
                          <p className="text-white">{b.title}</p>
                          <p className="text-xs text-muted">{b.roomType || b.detail}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">
                          {shortDate(b.startDate)} – {shortDate(b.endDate)}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">{money(b.price)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              b.status === 'confirmed'
                                ? 'bg-emerald-400/10 text-emerald-300'
                                : b.status === 'cancelled'
                                  ? 'bg-slate-400/10 text-slate-300'
                                  : 'bg-amber-400/10 text-amber-300'
                            }`}
                          >
                            {b.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Showing {ws.company.name}. Cross-account lookup across every customer arrives with the
            ent.nova backend; the view and search stay the same.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'brand' }) {
  return (
    <div className="rounded-2xl border border-line bg-navy p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold ${tone === 'brand' ? 'text-brand' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
