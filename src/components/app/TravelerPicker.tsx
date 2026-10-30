'use client';

import { Input, Select } from '@/components/app/ui';
import type { User } from '@/lib/types';

const OTHER = '__other__';

export interface TravelerSelection {
  travelerId: string;
  /** null = pick from the employee list; a string (even '') = a custom name. */
  guestName: string | null;
}

/**
 * Traveler selector for the booking flow. Lets you pick an employee (when
 * allowed) or choose "Enter another name" to book for someone not in the
 * system — a guest, candidate, or contractor. Renders just the control, so the
 * caller keeps its own <Field> label.
 */
export function TravelerPicker({
  users,
  canBookForOthers,
  selfUser,
  value,
  onChange,
  placeholder = 'Full name',
}: {
  users: User[];
  canBookForOthers: boolean;
  selfUser: User;
  value: TravelerSelection;
  onChange: (next: TravelerSelection) => void;
  placeholder?: string;
}) {
  const guestMode = value.guestName !== null;

  if (guestMode) {
    return (
      <div>
        <Input
          value={value.guestName ?? ''}
          onChange={(e) => onChange({ travelerId: selfUser.id, guestName: e.target.value })}
          placeholder={placeholder}
          autoFocus
        />
        <button
          type="button"
          onClick={() => onChange({ travelerId: selfUser.id, guestName: null })}
          className="mt-1 text-xs font-medium text-brand-dark hover:underline"
        >
          ← Choose from team
        </button>
      </div>
    );
  }

  const active = users.filter((u) => u.status === 'active');

  // Travelers who can only book for themselves still get the "other name"
  // option — the company policy decides whether that needs approval.
  const selectable = canBookForOthers ? active : active.filter((u) => u.id === selfUser.id);

  return (
    <Select
      value={value.travelerId}
      onChange={(e) => {
        if (e.target.value === OTHER) onChange({ travelerId: selfUser.id, guestName: '' });
        else onChange({ travelerId: e.target.value, guestName: null });
      }}
    >
      {selectable.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
      <option value={OTHER}>＋ Enter another name…</option>
    </Select>
  );
}
