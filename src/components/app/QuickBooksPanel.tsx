'use client';

import { AccountingSyncPanel } from '@/components/app/AccountingSyncPanel';
import type { Integration } from '@/lib/types';

/** QuickBooks Online — real OAuth + posting, via the shared accounting panel. */
export function QuickBooksPanel({ integration }: { integration: Integration }) {
  return (
    <AccountingSyncPanel
      integration={integration}
      provider={{
        id: 'quickbooks',
        name: 'QuickBooks',
        authProvider: 'Intuit',
        appLabel: 'Intuit app',
        postNoun: 'Purchases',
        glPlaceholder: 'Select GL account…',
        orgNoun: 'realm',
      }}
    />
  );
}
