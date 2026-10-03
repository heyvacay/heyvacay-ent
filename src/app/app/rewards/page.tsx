'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from '@/components/app/ui';
import { num, shortDate } from '@/lib/format';
import { Gift, Plane, Sparkles } from '@/components/icons';

const REWARDS = [
  {
    id: 'r_weekend',
    title: 'Weekend getaway credit',
    cost: 2000,
    detail: '$200 toward any personal HeyVacay hotel stay.',
  },
  {
    id: 'r_flight',
    title: 'Personal flight credit',
    cost: 3500,
    detail: '$350 toward a personal flight of your choice.',
  },
  {
    id: 'r_upgrade',
    title: 'Cabin upgrade',
    cost: 1200,
    detail: 'Bump to premium economy on your next personal trip.',
  },
  {
    id: 'r_lounge',
    title: 'Airport lounge day pass',
    cost: 800,
    detail: 'One-day lounge access, anywhere you fly.',
  },
];

export default function RewardsPage() {
  const { state, activeUser, pointsBalance, redeemPoints } = useStore();
  const balance = pointsBalance(activeUser.id);
  const [flash, setFlash] = useState<string | null>(null);

  const ledger = state.points
    .filter((p) => p.userId === activeUser.id)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const earned = ledger
    .filter((p) => p.delta > 0)
    .reduce((s, p) => s + p.delta, 0);

  const redeem = (r: (typeof REWARDS)[number]) => {
    if (balance < r.cost) return;
    redeemPoints(activeUser.id, r.cost, `Redeemed · ${r.title}`);
    setFlash(`Redeemed ${r.title}. Check your email for the credit.`);
    setTimeout(() => setFlash(null), 4000);
  };

  return (
    <div>
      <PageHeader
        title="Rewards"
        subtitle="You saved the company money — these points are your cut. Spend them on you."
      />

      {flash && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <Sparkles className="h-4 w-4" />
          {flash}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="ring-1 ring-brand/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
            Available balance
          </p>
          <p className="mt-2 font-display text-4xl font-extrabold text-brand-dark">
            {num(balance)}
          </p>
          <p className="mt-1 text-sm text-slate-500">points ready to spend</p>
        </Card>
        <StatCard label="Lifetime earned" value={num(earned)} sub="Since you joined" />
        <StatCard
          label="This is yours"
          value="100%"
          sub="Not the company's — yours"
        />
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-bold text-slate-900">
        Redeem
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {REWARDS.map((r) => {
          const affordable = balance >= r.cost;
          return (
            <Card key={r.id} className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand-dark">
                {r.id === 'r_flight' ? (
                  <Plane className="h-5 w-5" />
                ) : (
                  <Gift className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">{r.title}</p>
                  <Badge color="brand">{num(r.cost)} pts</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-400">{r.detail}</p>
                <Button
                  size="sm"
                  className="mt-3"
                  variant={affordable ? 'primary' : 'outline'}
                  disabled={!affordable}
                  onClick={() => redeem(r)}
                >
                  {affordable ? 'Redeem' : `Need ${num(r.cost - balance)} more`}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-bold text-slate-900">
        Activity
      </h2>
      {ledger.length === 0 ? (
        <EmptyState title="No points yet" sub="Book below market to start earning." />
      ) : (
        <Card pad={false}>
          <div className="divide-y divide-slate-100">
            {ledger.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-3.5 sm:px-6"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {p.reason}
                  </p>
                  <p className="text-xs text-slate-400">
                    {shortDate(p.createdAt)}
                    {p.bucket === 'booker' && ' · booker reward'}
                  </p>
                </div>
                <span
                  className={`font-display text-sm font-bold ${
                    p.delta >= 0 ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {p.delta >= 0 ? `+${num(p.delta)}` : num(p.delta)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
