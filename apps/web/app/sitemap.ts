import type { MetadataRoute } from 'next';

import { resolveSiteUrl } from '../lib/site-url';

const sitemap = (): MetadataRoute.Sitemap => {
  const siteUrl = resolveSiteUrl();
  const now = new Date();

  return [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1,
      alternates: {
        languages: {
          et: `${siteUrl}/`,
          en: `${siteUrl}/?locale=en`,
        },
      },
    },
    {
      url: `${siteUrl}/?locale=en`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.8,
      alternates: {
        languages: {
          et: `${siteUrl}/`,
          en: `${siteUrl}/?locale=en`,
        },
      },
    },
  ];
};

export default sitemap;
