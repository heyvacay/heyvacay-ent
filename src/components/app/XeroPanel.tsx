'use client';

import { AccountingSyncPanel } from '@/components/app/AccountingSyncPanel';
import type { Integration } from '@/lib/types';

/** Xero — real OAuth + posting, via the shared accounting panel. */
export function XeroPanel({ integration }: { integration: Integration }) {
  return (
    <AccountingSyncPanel
      integration={integration}
      provider={{
        id: 'xero',
        name: 'Xero',
        authProvider: 'Xero',
        appLabel: 'Xero app',
        postNoun: 'spend transactions',
        glPlaceholder: 'Select account…',
        orgNoun: 'org',
      }}
    />
  );
}
