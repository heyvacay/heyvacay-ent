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
  Avatar,
} from '@/components/app/ui';
import { money } from '@/lib/format';
import type { Role } from '@/lib/types';

export default function PeoplePage() {
  const { state, inviteUser, spentForScope } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    department: 'Sales',
    title: '',
    role: 'employee' as Role,
  });

  const departments = Array.from(
    new Set(state.users.map((u) => u.department))
  );

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    inviteUser(form);
    setForm({ name: '', email: '', department: 'Sales', title: '', role: 'employee' });
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="People"
        subtitle="Everyone with access to your travel program."
        actions={
          <Button onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Invite person'}
          </Button>
        }
      />

      {open && (
        <Card className="mb-6">
          <h2 className="mb-4 font-display text-lg font-bold text-slate-900">
            Invite a teammate
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jordan Lee"
              />
            </Field>
            <Field label="Work email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jordan@company.com"
              />
            </Field>
            <Field label="Department">
              <Select
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
              >
                {departments.map((d) => (
                  <option key={d}>{d}</option>
                ))}
                <option>Operations</option>
                <option>Finance</option>
              </Select>
            </Field>
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Account Executive"
              />
            </Field>
            <Field label="Role" hint="What they can do in the console.">
              <Select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as Role })
                }
              >
                <option value="employee">Employee — books their own travel</option>
                <option value="booker">Booker — books for others</option>
                <option value="admin">Admin — full program control</option>
              </Select>
            </Field>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={submit}>Send invite</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold sm:px-6">Person</th>
                <th className="px-5 py-3 font-semibold">Department</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Spend</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} />
                      <div>
                        <p className="font-medium text-slate-800">{u.name}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    <div>{u.department}</div>
                    <div className="text-xs text-slate-400">{u.title}</div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      color={
                        u.role === 'admin'
                          ? 'brand'
                          : u.role === 'booker'
                            ? 'amber'
                            : 'slate'
                      }
                    >
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-700">
                    {money(spentForScope('employee', u.id))}
                  </td>
                  <td className="px-5 py-3">
                    {u.status === 'active' && (
                      <Badge color="green">Active</Badge>
                    )}
                    {u.status === 'invited' && (
                      <Badge color="amber">Invited</Badge>
                    )}
                    {u.status === 'deactivated' && (
                      <Badge color="slate">Deactivated</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
