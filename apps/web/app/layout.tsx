import type { Metadata } from 'next';
import { Manrope, Newsreader } from 'next/font/google';

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
  title: 'VeeValve',
  description: 'Avalike randade ja basseinide vee kvaliteedi teavitused Eestis.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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
