import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';

import type { AppLocale, PlaceType, QualityStatus } from '@veevalve/core/client';

import { PlacesBrowser } from '../components/places-browser';
import {
  FAVORITE_PLACE_IDS_COOKIE_NAME,
  parseFavoritePlaceIds,
} from '../lib/favorites-storage';
import { EMPTY_PLACE_METRICS, fetchPlaceMetrics } from '../lib/fetch-place-metrics';
import { getPlaceMetricsFetchPolicy, getPlacesFetchPolicy } from '../lib/place-fetch-policy';
import { fetchPlaces } from '../lib/fetch-places';
import { resolveSiteUrl } from '../lib/site-url';
import {
  METRICS_PREFERENCES_COOKIE_NAME,
  parseMetricsUiPreferences,
  parsePlacesBrowserPreferences,
  PLACES_BROWSER_PREFERENCES_COOKIE_NAME,
} from '../lib/ui-preferences-storage';

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

const hasParam = (params: Record<string, string | string[] | undefined>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(params, key);

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

const getOpenGraphLocale = (locale: AppLocale): string => {
  return locale === 'en' ? 'en_GB' : 'et_EE';
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
  const openGraphLocale = getOpenGraphLocale(locale);
  const alternateLocale = openGraphLocale === 'en_GB' ? 'et_EE' : 'en_GB';

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
      locale: openGraphLocale,
      alternateLocale,
      images: [
        {
          url: '/opengraph-image',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/twitter-image'],
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
  const search = readParam(resolvedSearchParams, 'q')?.trim();
  const filterParamsExplicit =
    hasParam(resolvedSearchParams, 'type') || hasParam(resolvedSearchParams, 'status');
  const requestCookies = await cookies();
  const placesBrowserPreferences = parsePlacesBrowserPreferences(
    requestCookies.get(PLACES_BROWSER_PREFERENCES_COOKIE_NAME)?.value,
  );
  const initialFavoriteIds = parseFavoritePlaceIds(
    requestCookies.get(FAVORITE_PLACE_IDS_COOKIE_NAME)?.value,
  );
  const metricsUiPreferences = parseMetricsUiPreferences(
    requestCookies.get(METRICS_PREFERENCES_COOKIE_NAME)?.value,
  );
  const type = filterParamsExplicit
    ? normalizeType(readParam(resolvedSearchParams, 'type'))
    : placesBrowserPreferences.typeFilter;
  const status = filterParamsExplicit
    ? normalizeStatus(readParam(resolvedSearchParams, 'status'))
    : placesBrowserPreferences.statusFilter;
  const initialLimit = search ? 20 : 10;
  const initialNowIso = new Date().toISOString();
  const initialPlacesFetchPolicy = getPlacesFetchPolicy();
  const initialMetricsFetchPolicy = getPlaceMetricsFetchPolicy();
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
  const webApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'VeeValve',
    url: siteUrl,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    inLanguage: ['et', 'en'],
    browserRequirements: 'Requires JavaScript',
  };
  const jsonLdGraph = {
    '@context': 'https://schema.org',
    '@graph': [websiteSchema, organizationSchema, webApplicationSchema],
  };

  const [initialPlaces, initialMetrics] = await Promise.all([
    fetchPlaces({
      locale,
      type: type === 'ALL' ? undefined : type,
      status: status === 'ALL' ? undefined : status,
      search,
      limit: initialLimit,
      cacheMode: initialPlacesFetchPolicy.cacheMode,
      revalidateSeconds: initialPlacesFetchPolicy.revalidateSeconds,
      includeBadDetails: false,
    }),
    metricsUiPreferences.metricsVisible
      ? fetchPlaceMetrics({
          cacheMode: initialMetricsFetchPolicy.cacheMode,
          revalidateSeconds: initialMetricsFetchPolicy.revalidateSeconds,
        })
      : Promise.resolve(EMPTY_PLACE_METRICS),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce ?? undefined}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />
      <PlacesBrowser
        initialLocale={locale}
        initialType={type}
        initialStatus={status}
        initialSearch={search}
        initialNearbySearchEnabled={placesBrowserPreferences.nearbySearchEnabled}
        initialFavoritesVisible={placesBrowserPreferences.favoritesVisible}
        initialFavoriteIds={initialFavoriteIds}
        initialPlaces={initialPlaces}
        initialNowIso={initialNowIso}
        initialMetrics={initialMetrics}
        initialMetricsVisible={metricsUiPreferences.metricsVisible}
        initialMetricsExpanded={metricsUiPreferences.metricsExpanded}
      />
    </>
  );
};

export default HomePage;
