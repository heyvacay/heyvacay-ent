'use client';

import Link from 'next/link';
import { useCrm } from '@/lib/crmStore';
import { Card, PageHeader, Select, StatCard } from '@/components/app/ui';
import { money } from '@/lib/format';
import {
  DEAL_STAGE_LABEL,
  allDeals,
  openPipeline,
  weightedPipeline,
  winRate,
  wonValue,
  type Deal,
  type DealStage,
} from '@/lib/crm';

// Columns shown on the board — the active stages, left to right.
const BOARD: DealStage[] = ['qualify', 'proposal', 'negotiation', 'won'];

export default function PipelinePage() {
  const { companies, moveDeal } = useCrm();
  const deals = allDeals(companies);
  const nameFor = (id: string) => companies.find((c) => c.id === id)?.name ?? '—';

  const byStage = (s: DealStage) => deals.filter((d) => d.stage === s);
  const stageValue = (s: DealStage) => byStage(s).reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Every open opportunity across the book — move deals as they progress."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard accent label="Open pipeline" value={money(openPipeline(deals))} sub="All open deals" />
        <StatCard label="Weighted forecast" value={money(Math.round(weightedPipeline(deals)))} sub="Probability-adjusted" />
        <StatCard label="Closed won" value={money(wonValue(deals))} sub="ACV this period" />
        <StatCard label="Win rate" value={`${winRate(deals)}%`} sub="Won / closed" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {BOARD.map((stage) => {
          const col = byStage(stage);
          return (
            <div key={stage} className="rounded-2xl bg-slate-100/70 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-sm font-bold text-slate-700">{DEAL_STAGE_LABEL[stage]}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {col.length}
                </span>
              </div>
              <p className="mb-3 px-1 text-xs font-medium text-slate-400">
                {money(stageValue(stage))}
              </p>
              <div className="space-y-2">
                {col.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-slate-400">Nothing here</p>
                ) : (
                  col.map((d) => (
                    <DealCard key={d.id} deal={d} company={nameFor(d.companyId)} onMove={moveDeal} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({
  deal: d,
  company,
  onMove,
}: {
  deal: Deal;
  company: string;
  onMove: (companyId: string, dealId: string, stage: DealStage) => void;
}) {
  return (
    <Card pad={false} className="p-3">
      <Link
        href={`/sales/companies/${d.companyId}`}
        className="block text-sm font-semibold text-slate-800 hover:text-brand-dark"
      >
        {company}
      </Link>
      <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{d.name}</p>
      <p className="mt-2 font-display text-base font-bold text-slate-900">{money(d.value)}</p>
      <p className="text-[11px] text-slate-400">
        {d.probability}% · close {d.closeDate}
      </p>
      <div className="mt-2">
        <Select
          value={d.stage}
          onChange={(e) => onMove(d.companyId, d.id, e.target.value as DealStage)}
        >
          {(['qualify', 'proposal', 'negotiation', 'won', 'lost'] as DealStage[]).map((s) => (
            <option key={s} value={s}>
              {DEAL_STAGE_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
    </Card>
  );
}
