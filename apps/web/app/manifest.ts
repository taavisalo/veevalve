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
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
};

export default manifest;
