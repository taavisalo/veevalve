import type { Metadata } from 'next';
import { headers } from 'next/headers';

import type { AppLocale, PlaceType, QualityStatus } from '@veevalve/core/client';

import { PlacesBrowser } from '../components/places-browser';
import { EMPTY_PLACE_METRICS } from '../lib/fetch-place-metrics';
import { fetchPlaces } from '../lib/fetch-places';
import { resolveSiteUrl } from '../lib/site-url';

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const normalizeLocale = (value?: string): AppLocale => (value === 'en' ? 'en' : 'et');

const normalizeType = (value?: string): PlaceType | 'ALL' => {
  if (value === 'POOL' || value === 'BEACH') {
    return value;
  }

  return 'ALL';
};

const normalizeStatus = (value?: string): QualityStatus | 'ALL' => {
  if (value === 'GOOD' || value === 'BAD' || value === 'UNKNOWN') {
    return value;
  }

  return 'ALL';
};

const readParam = (
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined => {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
};

const getLocaleLandingPath = (locale: AppLocale): string => {
  return locale === 'en' ? '/?locale=en' : '/';
};

const getHomeTitle = (locale: AppLocale): string => {
  return locale === 'en'
    ? 'Water quality for beaches and pools in Estonia'
    : 'Vee kvaliteet randades ja basseinides Eestis';
};

const getHomeDescription = (locale: AppLocale): string => {
  return locale === 'en'
    ? 'Track latest public beach and pool water quality in Estonia with live status updates and favorites.'
    : 'Jälgi Eesti avalike randade ja basseinide värskeid vee kvaliteedi tulemusi, staatusemuutusi ja lemmikuid.';
};

const shouldNoIndexVariant = (params: {
  type: PlaceType | 'ALL';
  status: QualityStatus | 'ALL';
  search?: string;
}): boolean => {
  return Boolean(params.search) || params.type !== 'ALL' || params.status !== 'ALL';
};

export const generateMetadata = async ({ searchParams }: HomePageProps): Promise<Metadata> => {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const locale = normalizeLocale(readParam(resolvedSearchParams, 'locale'));
  const type = normalizeType(readParam(resolvedSearchParams, 'type'));
  const status = normalizeStatus(readParam(resolvedSearchParams, 'status'));
  const search = readParam(resolvedSearchParams, 'q')?.trim();
  const landingPath = getLocaleLandingPath(locale);
  const title = getHomeTitle(locale);
  const description = getHomeDescription(locale);
  const noIndexVariant = shouldNoIndexVariant({ type, status, search });

  return {
    title,
    description,
    alternates: {
      canonical: landingPath,
      languages: {
        et: '/',
        en: '/?locale=en',
        'x-default': '/',
      },
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url: landingPath,
      locale: locale === 'en' ? 'en_GB' : 'et_EE',
      alternateLocale: locale === 'en' ? 'et_EE' : 'en_GB',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    robots: noIndexVariant
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
  };
};

const HomePage = async ({ searchParams }: HomePageProps) => {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestHeaders = await headers();
  const nonce = requestHeaders.get('x-nonce') ?? undefined;

  const locale = normalizeLocale(readParam(resolvedSearchParams, 'locale'));
  const type = normalizeType(readParam(resolvedSearchParams, 'type'));
  const status = normalizeStatus(readParam(resolvedSearchParams, 'status'));
  const search = readParam(resolvedSearchParams, 'q')?.trim();
  const initialLimit = search ? 20 : 10;
  const initialNowIso = new Date().toISOString();
  const shouldCacheInitialPlaces = !search;
  const siteUrl = resolveSiteUrl();
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'VeeValve',
    url: siteUrl,
    inLanguage: ['et', 'en'],
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'VeeValve',
    url: siteUrl,
    logo: `${siteUrl}/apple-touch-icon.png`,
  };

  const initialPlaces = await fetchPlaces({
    locale,
    type: type === 'ALL' ? undefined : type,
    status: status === 'ALL' ? undefined : status,
    search,
    limit: initialLimit,
    cacheMode: shouldCacheInitialPlaces ? 'force-cache' : 'no-store',
    revalidateSeconds: shouldCacheInitialPlaces ? 60 : undefined,
    includeBadDetails: false,
  });

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce ?? undefined}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce ?? undefined}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <PlacesBrowser
        initialLocale={locale}
        initialType={type}
        initialStatus={status}
        initialSearch={search}
        initialPlaces={initialPlaces}
        initialNowIso={initialNowIso}
        initialMetrics={EMPTY_PLACE_METRICS}
      />
    </>
  );
};

export default HomePage;
