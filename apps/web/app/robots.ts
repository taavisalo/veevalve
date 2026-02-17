import type { MetadataRoute } from 'next';

import { resolveSiteUrl } from '../lib/site-url';

const robots = (): MetadataRoute.Robots => {
  const siteUrl = resolveSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
};

export default robots;
