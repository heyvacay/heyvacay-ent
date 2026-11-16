'use client';

import { useStore } from '@/lib/store';
import { Field, Input, Select } from '@/components/app/ui';
import type { CheckoutField } from '@/lib/types';

/** Active (non-archived) admin-defined checkout fields for this company. */
export function useCheckoutFields(): CheckoutField[] {
  const { checkoutFields } = useStore();
  return (checkoutFields ?? []).filter((f) => !f.archived);
}

/** The required fields that are still empty — used to gate the Book button. */
export function missingRequired(
  fields: CheckoutField[],
  values: Record<string, string>,
): CheckoutField[] {
  return fields.filter((f) => f.required && !(values[f.id] ?? '').trim());
}

/**
 * Read-only summary of a booking's captured custom-field values, resolving each
 * field id to its admin-defined label. Renders nothing when there are none.
 * Used on the trip detail and the approver's review.
 */
export function CustomFieldsSummary({
  values,
  className,
}: {
  values?: Record<string, string>;
  className?: string;
}) {
  const { checkoutFields } = useStore();
  const entries = Object.entries(values ?? {}).filter(([, v]) => (v ?? '').trim());
  if (entries.length === 0) return null;
  const labelFor = (id: string) =>
    (checkoutFields ?? []).find((f) => f.id === id)?.label || id;
  return (
    <div className={className}>
      {entries.map(([id, v]) => (
        <div key={id} className="flex justify-between gap-3 text-sm">
          <span className="text-slate-400">{labelFor(id)}</span>
          <span className="text-right font-medium text-slate-700 dark:text-slate-200">{v}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Renders the company's custom checkout fields (project code, trip reason, …)
 * on a booking flow. Controlled: the parent owns the `values` map and passes
 * `onChange`. Renders nothing when the admin hasn't configured any fields.
 */
export function CheckoutFields({
  values,
  onChange,
  className,
}: {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  className?: string;
}) {
  const fields = useCheckoutFields();
  if (fields.length === 0) return null;

  const set = (id: string, v: string) => onChange({ ...values, [id]: v });

  return (
    <div className={className}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const label = f.required ? `${f.label} *` : f.label;
          const val = values[f.id] ?? '';
          return (
            <Field key={f.id} label={label}>
              {f.type === 'select' ? (
                <Select value={val} onChange={(e) => set(f.id, e.target.value)}>
                  <option value="">{f.placeholder || 'Select…'}</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={val}
                  onChange={(e) => set(f.id, e.target.value)}
                  placeholder={f.placeholder || ''}
                />
              )}
            </Field>
          );
        })}
      </div>
    </div>
  );
}
