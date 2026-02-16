import type { Metadata } from 'next';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/newsreader/700.css';

import './globals.css';

export const metadata: Metadata = {
  title: 'VeeValve',
  description: 'Avalike randade ja basseinide vee kvaliteedi teavitused Eestis.',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

const RootLayout = ({ children }: RootLayoutProps) => {
  return (
    <html lang="et">
      <body className="bg-surface text-ink antialiased">
        <div className="min-h-screen bg-grid-pattern">{children}</div>
      </body>
    </html>
  );
};

export default RootLayout;
