import type { Metadata } from 'next';
import { Manrope, Newsreader } from 'next/font/google';

import { resolveSiteUrl } from '../lib/site-url';
import './globals.css';

const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-body',
});

const titleFont = Newsreader({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-title',
});

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: {
    default: 'VeeValve',
    template: '%s | VeeValve',
  },
  description: 'Avalike randade ja basseinide vee kvaliteedi teavitused Eestis.',
  applicationName: 'VeeValve',
  generator: 'Next.js',
  referrer: 'strict-origin-when-cross-origin',
  keywords: [
    'vee kvaliteet',
    'rannad',
    'basseinid',
    'Eesti',
    'water quality',
    'beaches',
    'pools',
    'Estonia',
  ],
  alternates: {
    canonical: '/',
    languages: {
      et: '/',
      en: '/?locale=en',
      'x-default': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'et_EE',
    alternateLocale: 'en_GB',
    siteName: 'VeeValve',
    title: 'VeeValve',
    description: 'Avalike randade ja basseinide vee kvaliteedi teavitused Eestis.',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title: 'VeeValve',
    description: 'Avalike randade ja basseinide vee kvaliteedi teavitused Eestis.',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  category: 'health',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="et">
      <body className={`${bodyFont.variable} ${titleFont.variable} bg-surface text-ink antialiased`}>
        <div className="min-h-screen bg-grid-pattern">{children}</div>
      </body>
    </html>
  );
};

export default RootLayout;
