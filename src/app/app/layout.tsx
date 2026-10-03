import type { Metadata } from 'next';
import { StoreProvider } from '@/lib/store';
import AppShell from '@/components/app/AppShell';

export const metadata: Metadata = {
  title: 'HeyVacay Enterprise — Console',
  robots: { index: false, follow: false },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreProvider>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
