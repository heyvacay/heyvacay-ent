import type { Metadata } from 'next';
import { StoreProvider } from '@/lib/store';

export const metadata: Metadata = {
  title: 'Sign in — HeyVacay Enterprise',
  description: 'Sign in to your HeyVacay Enterprise workspace.',
  robots: { index: false, follow: false },
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoreProvider>{children}</StoreProvider>;
}
