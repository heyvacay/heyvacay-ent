import type { ReactNode } from 'react';
import { CrmProvider } from '@/lib/crmStore';
import SalesShell from '@/components/sales/SalesShell';

export default function SalesLayout({ children }: { children: ReactNode }) {
  return (
    <CrmProvider>
      <SalesShell>{children}</SalesShell>
    </CrmProvider>
  );
}
