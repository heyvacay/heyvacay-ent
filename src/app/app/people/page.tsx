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
  const { state, inviteUser, updateUser, spentForScope } = useStore();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ id: string; name: string; title: string; department: string } | null>(
    null
  );
  const [form, setForm] = useState({
    name: '',
    email: '',
    department: 'Sales',
    title: '',
    role: 'employee' as Role,
  });

  const resetPassword = (email: string) =>
    window.alert(`Password reset link sent to ${email}.`);

  const departments = Array.from(
    new Set(state.users.map((u) => u.department))
  );

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    inviteUser(form);
    window.alert(`Invite email sent to ${form.email}. They'll verify their email and join your workspace.`);
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
                <th className="px-5 py-3 text-right font-semibold sm:px-6">Manage</th>
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
                    <span className="inline-block w-32">
                      <Select
                        value={u.role}
                        onChange={(e) => updateUser(u.id, { role: e.target.value as Role })}
                      >
                        <option value="employee">Employee</option>
                        <option value="booker">Booker</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </span>
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
                  <td className="px-5 py-3 sm:px-6">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEdit({ id: u.id, name: u.name, title: u.title, department: u.department })
                        }
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resetPassword(u.email)}>
                        Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          updateUser(u.id, {
                            status: u.status === 'deactivated' ? 'active' : 'deactivated',
                          })
                        }
                      >
                        {u.status === 'deactivated' ? 'Reactivate' : 'Deactivate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
          onClick={() => setEdit(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-display text-lg font-bold text-slate-900">Edit person</h2>
            </div>
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <Field label="Name">
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <Field label="Title">
                <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
              </Field>
              <Field label="Department">
                <Input value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateUser(edit.id, {
                    name: edit.name.trim(),
                    title: edit.title.trim(),
                    department: edit.department.trim(),
                  });
                  setEdit(null);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
