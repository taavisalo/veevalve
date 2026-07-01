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
const appleStartupImages = [
  { url: '/apple-startup/veevalve-640x1136.png', width: 320, height: 568, ratio: 2 },
  { url: '/apple-startup/veevalve-750x1334.png', width: 375, height: 667, ratio: 2 },
  { url: '/apple-startup/veevalve-828x1792.png', width: 414, height: 896, ratio: 2 },
  { url: '/apple-startup/veevalve-1125x2436.png', width: 375, height: 812, ratio: 3 },
  { url: '/apple-startup/veevalve-1170x2532.png', width: 390, height: 844, ratio: 3 },
  { url: '/apple-startup/veevalve-1179x2556.png', width: 393, height: 852, ratio: 3 },
  { url: '/apple-startup/veevalve-1206x2622.png', width: 402, height: 874, ratio: 3 },
  { url: '/apple-startup/veevalve-1242x2208.png', width: 414, height: 736, ratio: 3 },
  { url: '/apple-startup/veevalve-1242x2688.png', width: 414, height: 896, ratio: 3 },
  { url: '/apple-startup/veevalve-1284x2778.png', width: 428, height: 926, ratio: 3 },
  { url: '/apple-startup/veevalve-1290x2796.png', width: 430, height: 932, ratio: 3 },
  { url: '/apple-startup/veevalve-1320x2868.png', width: 440, height: 956, ratio: 3 },
  { url: '/apple-startup/veevalve-1536x2048.png', width: 768, height: 1024, ratio: 2 },
  { url: '/apple-startup/veevalve-1620x2160.png', width: 810, height: 1080, ratio: 2 },
  { url: '/apple-startup/veevalve-1640x2360.png', width: 820, height: 1180, ratio: 2 },
  { url: '/apple-startup/veevalve-1668x2224.png', width: 834, height: 1112, ratio: 2 },
  { url: '/apple-startup/veevalve-1668x2388.png', width: 834, height: 1194, ratio: 2 },
  { url: '/apple-startup/veevalve-2048x2732.png', width: 1024, height: 1366, ratio: 2 },
].map(({ url, width, height, ratio }) => ({
  url,
  media: `(device-width: ${String(width)}px) and (device-height: ${String(
    height,
  )}px) and (-webkit-device-pixel-ratio: ${String(ratio)}) and (orientation: portrait)`,
}));

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
    startupImage: appleStartupImages,
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
