import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const SITE_URL = 'https://ent.heyvacay.co';
const TITLE = 'HeyVacay Enterprise — Cut your T&E spend. 100% free.';
const DESCRIPTION =
  'Corporate travel & expense, completely free. HeyVacay Enterprise slashes T&E spend with budgets, policy controls, savings rewards, and a full expense suite — every feature included, no fees. We earn commission on bookings, never from you.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'corporate travel',
    'travel and expense',
    'T&E savings',
    'business travel management',
    'expense management',
    'free travel management software',
    'HeyVacay Enterprise',
  ],
  applicationName: 'HeyVacay Enterprise',
  authors: [{ name: 'HeyVacay' }],
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'HeyVacay Enterprise',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a1426',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
