import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Manrope, Newsreader } from 'next/font/google';

import { resolveSiteUrl } from '../lib/site-url';
import {
  parseThemeUiPreferences,
  THEME_PREFERENCES_COOKIE_NAME,
} from '../lib/ui-preferences-storage';
import { ServiceWorkerRegistration } from '../components/service-worker-registration';
import './globals.css';

const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-body',
});

const titleFont = Newsreader({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-title',
});

const siteName = 'VeeValve';
const siteDescription = 'Avalike randade ja basseinide vee kvaliteedi teavitused Eestis.';

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  generator: 'Next.js',
  referrer: 'strict-origin-when-cross-origin',
  creator: siteName,
  publisher: siteName,
  authors: [{ name: siteName }],
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: 'default',
  },
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
    siteName,
    title: siteName,
    description: siteDescription,
    url: '/',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: `${siteName} — vee kvaliteet randades ja basseinides`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteName,
    description: siteDescription,
    images: ['/twitter-image.png'],
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: '#0a8f78',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

const RootLayout = async ({ children }: RootLayoutProps) => {
  const requestCookies = await cookies();
  const themePreferences = parseThemeUiPreferences(
    requestCookies.get(THEME_PREFERENCES_COOKIE_NAME)?.value,
  );
  const themeClassName = themePreferences.theme === 'system' ? undefined : themePreferences.theme;

  return (
    <html lang="et" className={themeClassName}>
      <body
        className={`${bodyFont.variable} ${titleFont.variable} bg-surface text-ink antialiased`}
      >
        <ServiceWorkerRegistration />
        <div className="min-h-screen bg-grid-pattern">{children}</div>
      </body>
    </html>
  );
};

export default RootLayout;
