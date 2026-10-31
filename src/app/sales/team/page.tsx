'use client';

import { useState } from 'react';
import { useCrm } from '@/lib/crmStore';
import { Badge, Button, Card, Field, Input, PageHeader, Select } from '@/components/app/ui';
import { money } from '@/lib/format';
import { ME, isCrmAdmin, type RepRole } from '@/lib/crm';

const ROLES: RepRole[] = ['C-Suite', 'Admin', 'Account Executive', 'SDR'];

export default function TeamPage() {
  const { reps, companies, addRep, updateRep, removeRep, viewerRole } = useCrm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'Account Executive' as RepRole, quota: 1_000_000 });

  // Admin and C-Suite can manage the team (C-Suite sits above Admin).
  const isAdmin = isCrmAdmin(viewerRole);

  const wonFor = (name: string) =>
    companies
      .flatMap((c) => c.deals)
      .filter((d) => d.owner === name && d.stage === 'won')
      .reduce((s, d) => s + d.value, 0);

  const create = () => {
    if (!form.name.trim()) return;
    addRep({ name: form.name.trim(), email: form.email.trim() || undefined, role: form.role, quota: Number(form.quota) || 0 });
    setForm({ name: '', email: '', role: 'Account Executive', quota: 1_000_000 });
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Team & quotas"
        subtitle="Manage your sales reps, their roles, and annual quotas."
        actions={isAdmin ? <Button onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'Add rep'}</Button> : undefined}
      />

      {!isAdmin && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-700">Only an admin or C-Suite can edit the team. You can view it here.</p>
        </Card>
      )}

      {open && isAdmin && (
        <Card className="mb-6">
          <h2 className="mb-4 font-display text-lg font-bold text-slate-900">Add a rep</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jordan P." autoFocus /></Field>
            <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jordan@heyvacay.co" /></Field>
            <Field label="Role">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as RepRole })}>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Annual quota (ACV)"><Input type="number" value={form.quota} onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} /></Field>
          </div>
          <div className="mt-5"><Button onClick={create} disabled={!form.name.trim()}>Add rep</Button></div>
        </Card>
      )}

      <Card pad={false} className="divide-y divide-slate-100">
        {reps.map((r) => {
          const won = wonFor(r.name);
          const pct = r.quota > 0 ? Math.round((won / r.quota) * 100) : 0;
          return (
            <div key={r.name} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-800">{r.name}{r.name === ME && ' · you'}</p>
                  <Badge color={isCrmAdmin(r.role) ? 'brand' : 'slate'}>{r.role}</Badge>
                </div>
                <p className="text-xs text-slate-400">{r.email ?? '—'} · {money(won)} won ({pct}% of quota)</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <>
                    <span className="w-44">
                      <Select value={r.role} onChange={(e) => updateRep(r.name, { role: e.target.value as RepRole })}>
                        {ROLES.map((role) => <option key={role}>{role}</option>)}
                      </Select>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="text-sm text-slate-400">$</span>
                      <input
                        type="number"
                        value={r.quota}
                        onChange={(e) => updateRep(r.name, { quota: Number(e.target.value) })}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                      />
                    </span>
                    {r.name !== ME && (
                      <button onClick={() => removeRep(r.name)} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600">
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-sm font-semibold text-slate-700">{money(r.quota)} quota</span>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
