import type { Metadata } from 'next';
import { StoreProvider } from '@/lib/store';

export const metadata: Metadata = {
  title: 'Join your team — HeyVacay Enterprise',
  description: 'Accept your invite and set up your HeyVacay profile.',
  robots: { index: false, follow: false },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}
