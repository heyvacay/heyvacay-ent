'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
} from '@/components/app/ui';
import type { PolicyAction, PolicyType } from '@/lib/types';

const TYPE_LABEL: Record<PolicyType, string> = {
  max_hotel_star: 'Max hotel stars',
  max_nightly: 'Max nightly rate',
  max_cabin: 'Max flight cabin',
  advance_days: 'Minimum days ahead',
};

const ACTION_LABEL: Record<PolicyAction, string> = {
  allow: 'Allow',
  warn: 'Warn traveler',
  approve: 'Needs approval',
  block: 'Block booking',
};

const ACTION_COLOR: Record<PolicyAction, 'slate' | 'amber' | 'brand' | 'red'> = {
  allow: 'slate',
  warn: 'amber',
  approve: 'brand',
  block: 'red',
};

export default function PoliciesPage() {
  const { state, addPolicy, togglePolicy } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'max_nightly' as PolicyType,
    value: '',
    action: 'warn' as PolicyAction,
  });

  const submit = () => {
    if (!form.name.trim()) return;
    const numeric = form.type !== 'max_cabin';
    addPolicy({
      name: form.name,
      type: form.type,
      value: numeric ? Number(form.value) || 0 : form.value || 'Economy',
      action: form.action,
      enabled: true,
    });
    setForm({ name: '', type: 'max_nightly', value: '', action: 'warn' });
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Policies"
        subtitle="Guardrails that run the moment someone books — no spreadsheets, no chasing."
        actions={
          <Button onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'New policy'}
          </Button>
        }
      />

      {open && (
        <Card className="mb-6">
          <h2 className="mb-4 font-display text-lg font-bold text-slate-900">
            Create a policy
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nightly rate cap $300"
              />
            </Field>
            <Field label="Rule">
              <Select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as PolicyType })
                }
              >
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Value"
              hint={
                form.type === 'max_cabin'
                  ? 'e.g. Economy, Premium, Business'
                  : form.type === 'advance_days'
                    ? 'Days before travel'
                    : 'A number'
              }
            >
              <Input
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === 'max_cabin' ? 'Economy' : '300'}
              />
            </Field>
            <Field label="When exceeded">
              <Select
                value={form.action}
                onChange={(e) =>
                  setForm({ ...form, action: e.target.value as PolicyAction })
                }
              >
                {Object.entries(ACTION_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={submit}>Add policy</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {state.policies.map((p) => (
          <Card key={p.id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-800">{p.name}</p>
                <Badge color={ACTION_COLOR[p.action]}>
                  {ACTION_LABEL[p.action]}
                </Badge>
                {!p.enabled && <Badge color="slate">Off</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {TYPE_LABEL[p.type]}: <span className="text-slate-600">{p.value}</span>
              </p>
            </div>
            <button
              onClick={() => togglePolicy(p.id)}
              role="switch"
              aria-checked={p.enabled}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                p.enabled ? 'bg-brand' : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  p.enabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
