'use client';

import Link from 'next/link';
import { useCrm } from '@/lib/crmStore';
import { Badge, Button, Card, EmptyState, PageHeader, Select, StatCard } from '@/components/app/ui';
import { money, shortDate } from '@/lib/format';
import {
  CONTRACT_STATUS_COLOR,
  CONTRACT_STATUS_LABEL,
  CONTRACT_TYPE_LABEL,
  type ContractStatus,
} from '@/lib/crm';
import { contractPdf } from '@/lib/pdf';
import { Receipt } from '@/components/icons';

export default function ContractsPage() {
  const { companies, setContractStatus } = useCrm();

  const rows = companies
    .flatMap((c) => c.contracts.map((ct) => ({ ct, company: c })))
    .sort((a, b) => (a.ct.createdAt < b.ct.createdAt ? 1 : -1));

  const signedValue = rows
    .filter((r) => r.ct.status === 'signed')
    .reduce((s, r) => s + r.ct.value, 0);
  const outValue = rows
    .filter((r) => r.ct.status === 'sent')
    .reduce((s, r) => s + r.ct.value, 0);

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle="Every agreement across the book — generate, send, and track to signature."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard accent label="Signed value" value={money(signedValue)} sub="Closed ACV" />
        <StatCard label="Out for signature" value={money(outValue)} sub="Awaiting signature" />
        <StatCard label="Total contracts" value={String(rows.length)} sub="All statuses" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No contracts yet"
          sub="Open a company and use Generate contract to create your first one."
        />
      ) : (
        <Card pad={false} className="divide-y divide-slate-100">
          {rows.map(({ ct, company }) => (
            <div key={ct.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/sales/companies/${company.id}`}
                    className="font-semibold text-slate-800 hover:text-brand-dark"
                  >
                    {company.name}
                  </Link>
                  <Badge color={CONTRACT_STATUS_COLOR[ct.status]}>
                    {CONTRACT_STATUS_LABEL[ct.status]}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {CONTRACT_TYPE_LABEL[ct.terms.type]} · {money(ct.value)} ACV ·{' '}
                  {ct.terms.termMonths}mo · created {shortDate(ct.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-40">
                  <Select
                    value={ct.status}
                    onChange={(e) =>
                      setContractStatus(company.id, ct.id, e.target.value as ContractStatus)
                    }
                  >
                    {(['draft', 'sent', 'signed'] as ContractStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {CONTRACT_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                </span>
                <Button size="sm" variant="outline" onClick={() => contractPdf(company, ct)}>
                  <Receipt className="h-4 w-4" /> PDF
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
