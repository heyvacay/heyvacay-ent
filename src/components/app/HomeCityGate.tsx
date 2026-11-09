'use client';

import { useState } from 'react';
import { Logo } from './Logo';
import { Button, Field, Input } from './ui';
import { MapPin, Check } from '@/components/icons';

/**
 * One-time blocking prompt shown right after the first-login welcome tour, only
 * when the company didn't set a home city for this person. We need it to know
 * whether a trip requires a hotel (an event in their home city doesn't), to
 * pre-fill their departure city on flight search, and to keep per-office spend
 * accurate — so we ask before they start using the app.
 */
export function HomeCityGate({
  firstName,
  onSave,
}: {
  firstName: string;
  onSave: (city: string) => void;
}) {
  const [city, setCity] = useState('');
  const ready = city.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-navy-deep/95 px-5 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-5 flex justify-center">
          <Logo imgClassName="h-8" />
        </div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand/15 text-brand-dark">
          <MapPin className="h-6 w-6" />
        </div>
        <h1 className="text-center font-display text-xl font-bold text-slate-900 dark:text-white">
          Where are you based, {firstName}?
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Your home city helps us do the right thing automatically: skip a hotel
          when a trip is in your own city, pre-fill your departure airport for
          flights, and keep spend accurate per office. You can change it anytime
          in Preferences.
        </p>
        <div className="mt-5 space-y-4">
          <Field label="Home city">
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Austin, TX"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ready) onSave(city.trim());
              }}
            />
          </Field>
          {ready && (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" /> Got it.
            </p>
          )}
          <Button
            className="w-full"
            disabled={!ready}
            onClick={() => onSave(city.trim())}
          >
            Save &amp; continue
          </Button>
        </div>
      </div>
    </div>
  );
}
