'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Badge, Button, Card, PageHeader, StatCard } from '@/components/app/ui';
import { Check } from '@/components/icons';
import { IntegrationLogo } from '@/components/app/IntegrationLogo';
import type { Integration } from '@/lib/types';

export default function IntegrationsPage() {
  const { state } = useStore();

  const connected = state.integrations.filter((i) => i.status === 'connected').length;
  const requested = state.integrations.filter((i) => i.status === 'requested').length;

  const cats = useMemo(() => {
    const map = new Map<string, Integration[]>();
    for (const it of state.integrations) {
      const arr = map.get(it.category) ?? [];
      arr.push(it);
      map.set(it.category, arr);
    }
    return Array.from(map.entries());
  }, [state.integrations]);

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Sync accounting, HR, cards, and identity so expensing reconciles itself — no receipts chased."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Connected" value={connected} sub="Syncing now" />
        <StatCard label="Requested" value={requested} sub="Setup in progress" />
        <StatCard
          accent
          label="Expensing"
          value="Automatic"
          sub="Matched to the right GL codes"
        />
      </div>

      <div className="mt-8 space-y-8">
        {cats.map(([cat, items]) => (
          <section key={cat}>
            <h2 className="mb-3 font-display text-lg font-bold text-slate-900">
              {cat}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((it) => (
                <Card key={it.id} className="flex items-start gap-4">
                  <IntegrationLogo id={it.id} name={it.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800">{it.name}</p>
                      {it.status === 'connected' && (
                        <Badge color="green">
                          <Check className="h-3 w-3" /> Connected
                        </Badge>
                      )}
                      {it.status === 'requested' && (
                        <Badge color="amber">Requested</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{it.blurb}</p>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant={it.status === 'connected' ? 'outline' : 'primary'}
                        href={`/app/integrations/${it.id}`}
                      >
                        {it.status === 'connected'
                          ? 'Manage'
                          : it.status === 'requested'
                            ? 'Finish setup'
                            : 'Set up'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
