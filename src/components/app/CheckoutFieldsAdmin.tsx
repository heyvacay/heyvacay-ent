'use client';

import { useStore } from '@/lib/store';
import { Button, Card, Input, Select } from '@/components/app/ui';
import type { CheckoutField } from '@/lib/types';

let seq = 0;
const newId = () => `cf_${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Admin control for custom checkout fields (project code, trip reason, cost
 * center, …). Each field is shown on every booking flow and captured onto the
 * trip. Required fields block the Book button until filled.
 */
export function CheckoutFieldsAdmin() {
  const { checkoutFields, setCheckoutFields } = useStore();
  const fields = checkoutFields ?? [];

  const update = (id: string, patch: Partial<CheckoutField>) =>
    setCheckoutFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const remove = (id: string) => setCheckoutFields(fields.filter((f) => f.id !== id));
  const add = () =>
    setCheckoutFields([
      ...fields,
      { id: newId(), label: '', type: 'text', required: false },
    ]);

  return (
    <Card>
      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
        Custom checkout fields
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Collect extra info at booking — a project code, trip reason, cost center, and so on. These
        appear on every flight &amp; hotel checkout and are saved on the trip (and shown to the
        approver). Mark a field required to make it mandatory before booking.
      </p>

      <div className="mt-4 space-y-3">
        {fields.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400 dark:border-white/10">
            No custom fields yet. Add one like “Project code” or “Trip reason”.
          </p>
        )}

        {fields.map((f) => (
          <div
            key={f.id}
            className="rounded-xl border border-slate-200 p-3 dark:border-white/10"
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_auto]">
              <Input
                value={f.label}
                onChange={(e) => update(f.id, { label: e.target.value })}
                placeholder="Field label (e.g. Project code)"
              />
              <Select
                value={f.type}
                onChange={(e) =>
                  update(f.id, { type: e.target.value as CheckoutField['type'] })
                }
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Dropdown</option>
              </Select>
              <label className="inline-flex items-center gap-1.5 whitespace-nowrap px-1 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => update(f.id, { required: e.target.checked })}
                  className="h-4 w-4 rounded text-brand focus:ring-brand"
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label="Remove field"
                className="grid h-9 w-9 place-items-center rounded-lg text-lg leading-none text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                ×
              </button>
            </div>

            {f.type === 'select' && (
              <Input
                value={(f.options ?? []).join(', ')}
                onChange={(e) =>
                  update(f.id, {
                    options: e.target.value
                      .split(',')
                      .map((o) => o.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Dropdown options, comma-separated (e.g. Sales, Eng, Ops)"
                className="mt-2"
              />
            )}
            <Input
              value={f.placeholder ?? ''}
              onChange={(e) => update(f.id, { placeholder: e.target.value || undefined })}
              placeholder="Placeholder / helper text (optional)"
              className="mt-2"
            />
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="mt-4" onClick={add}>
        + Add field
      </Button>
    </Card>
  );
}
