import type { Metadata } from 'next';
import { StoreProvider } from '@/lib/store';

export const metadata: Metadata = {
  title: 'Get started — HeyVacay Enterprise',
  description:
    'Set up your corporate travel & expense program in about two minutes. 100% free for companies.',
  robots: { index: false, follow: false },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoreProvider>{children}</StoreProvider>;
}
