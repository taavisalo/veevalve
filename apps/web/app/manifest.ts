import type { MetadataRoute } from 'next';

const manifest = (): MetadataRoute.Manifest => {
  return {
    name: 'VeeValve',
    short_name: 'VeeValve',
    description: 'Avalike randade ja basseinide vee kvaliteedi teavitused Eestis.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f2f7f5',
    theme_color: '#0a8f78',
    lang: 'et',
    icons: [
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
};

export default manifest;
