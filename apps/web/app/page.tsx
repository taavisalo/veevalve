import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { Suspense } from 'react';

import type { AppLocale, PlaceType, QualityStatus } from '@veevalve/core/client';

import { PlacesBrowser } from '../components/places-browser';
import { FAVORITE_PLACE_IDS_COOKIE_NAME, parseFavoritePlaceIds } from '../lib/favorites-storage';
import { EMPTY_PLACE_METRICS, fetchPlaceMetrics } from '../lib/fetch-place-metrics';
import { getPlaceMetricsFetchPolicy, getPlacesFetchPolicy } from '../lib/place-fetch-policy';
import { fetchPlaces } from '../lib/fetch-places';
import { resolveSiteUrl } from '../lib/site-url';
import {
  METRICS_PREFERENCES_COOKIE_NAME,
  parseMetricsUiPreferences,
  parsePlacesBrowserPreferences,
  parseThemeUiPreferences,
  PLACES_BROWSER_PREFERENCES_COOKIE_NAME,
  THEME_PREFERENCES_COOKIE_NAME,
  type AppTheme,
} from '../lib/ui-preferences-storage';

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const runtime = 'edge';
export const preferredRegion = 'home';

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
    : 'Vee kvaliteet Eesti randades ja basseinides';
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

interface PlacesBrowserDataProps {
  locale: AppLocale;
  type: PlaceType | 'ALL';
  status: QualityStatus | 'ALL';
  search?: string;
  initialNearbySearchEnabled: boolean;
  initialFavoritesVisible: boolean;
  initialFavoriteIds: string[];
  initialMetricsVisible: boolean;
  initialMetricsExpanded: boolean;
  initialTheme: AppTheme;
}

const PlacesBrowserFallback = ({ locale }: { locale: AppLocale }) => {
  return (
    <main
      className="mx-auto max-w-6xl px-3 pb-16 pt-6 sm:px-4 sm:pt-8 md:px-8 md:pt-14"
      aria-busy="true"
    >
      <section className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/75 p-4 shadow-card backdrop-blur dark:border-teal-400/20 dark:bg-slate-950/60 sm:p-6 md:p-8">
        <div className="flex items-start justify-between gap-2">
          <p className="shrink-0 text-xs uppercase tracking-[0.08em] text-accent sm:text-sm sm:tracking-[0.14em]">
            VeeValve
          </p>
          <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-1.5">
            <span className="h-6 w-6 rounded-full border border-emerald-100 bg-white dark:border-teal-400/30 dark:bg-slate-900 sm:h-7 sm:w-7" />
            <span className="h-6 w-11 rounded-full border border-emerald-100 bg-white dark:border-teal-400/30 dark:bg-slate-900 sm:h-7 sm:w-12" />
            <span className="h-6 w-16 rounded-full border border-emerald-100 bg-white dark:border-teal-400/30 dark:bg-slate-900 sm:h-7 sm:w-20" />
          </div>
        </div>

        <h1 className="mt-3 text-3xl leading-tight text-ink sm:text-4xl md:text-5xl">
          {locale === 'et'
            ? 'Vee kvaliteet randades ja basseinides'
            : 'Water quality for beaches and pools'}
        </h1>

        <div className="mt-5 max-w-3xl">
          <div className="h-14 rounded-2xl border border-emerald-200 bg-white shadow-card dark:border-teal-400/25 dark:bg-slate-950/80" />
          <div className="mt-2 h-4 w-2/3 max-w-md rounded bg-emerald-100/80 dark:bg-teal-300/15" />
        </div>

        <div className="-mx-0.5 mt-5 overflow-hidden pb-1">
          <div className="flex min-w-max items-center gap-1 px-0.5">
            {[90, 72, 72, 84, 76].map((width, index) => (
              <span
                key={`${width}-${index}`}
                className="h-7 rounded-full border border-emerald-100 bg-white dark:border-teal-400/25 dark:bg-slate-900"
                style={{ width }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="sr-only">{locale === 'et' ? 'Tulemused' : 'Results'}</h2>
        <div className="mb-3 h-4 w-48 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
        <div className="grid gap-4 md:grid-cols-2" role="status">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="min-h-52 rounded-xl border border-emerald-100 bg-card p-4 shadow-card dark:border-teal-400/20"
            >
              <div className="h-4 w-24 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
              <div className="mt-4 h-7 w-2/3 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
              <div className="mt-3 h-4 w-1/2 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
              <div className="mt-6 h-16 rounded-lg bg-emerald-100/80 dark:bg-teal-300/15" />
            </div>
          ))}
          <span className="sr-only">
            {locale === 'et' ? 'Laadin tulemusi...' : 'Loading results...'}
          </span>
        </div>
      </section>
    </main>
  );
};

const PlacesBrowserData = async ({
  locale,
  type,
  status,
  search,
  initialNearbySearchEnabled,
  initialFavoritesVisible,
  initialFavoriteIds,
  initialMetricsVisible,
  initialMetricsExpanded,
  initialTheme,
}: PlacesBrowserDataProps) => {
  const initialLimit = search ? 20 : 10;
  const initialNowIso = new Date().toISOString();
  const initialPlacesFetchPolicy = getPlacesFetchPolicy();
  const initialMetricsFetchPolicy = getPlaceMetricsFetchPolicy();

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
    initialMetricsVisible
      ? fetchPlaceMetrics({
          cacheMode: initialMetricsFetchPolicy.cacheMode,
          revalidateSeconds: initialMetricsFetchPolicy.revalidateSeconds,
        })
      : Promise.resolve(EMPTY_PLACE_METRICS),
  ]);

  return (
    <PlacesBrowser
      initialLocale={locale}
      initialType={type}
      initialStatus={status}
      initialSearch={search}
      initialNearbySearchEnabled={initialNearbySearchEnabled}
      initialFavoritesVisible={initialFavoritesVisible}
      initialFavoriteIds={initialFavoriteIds}
      initialPlaces={initialPlaces}
      initialNowIso={initialNowIso}
      initialMetrics={initialMetrics}
      initialMetricsVisible={initialMetricsVisible}
      initialMetricsExpanded={initialMetricsExpanded}
      initialTheme={initialTheme}
    />
  );
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
  const themeUiPreferences = parseThemeUiPreferences(
    requestCookies.get(THEME_PREFERENCES_COOKIE_NAME)?.value,
  );
  const type = filterParamsExplicit
    ? normalizeType(readParam(resolvedSearchParams, 'type'))
    : placesBrowserPreferences.typeFilter;
  const status = filterParamsExplicit
    ? normalizeStatus(readParam(resolvedSearchParams, 'status'))
    : placesBrowserPreferences.statusFilter;
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

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce ?? undefined}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />
      <Suspense fallback={<PlacesBrowserFallback locale={locale} />}>
        <PlacesBrowserData
          locale={locale}
          type={type}
          status={status}
          search={search}
          initialNearbySearchEnabled={placesBrowserPreferences.nearbySearchEnabled}
          initialFavoritesVisible={placesBrowserPreferences.favoritesVisible}
          initialFavoriteIds={initialFavoriteIds}
          initialMetricsVisible={metricsUiPreferences.metricsVisible}
          initialMetricsExpanded={metricsUiPreferences.metricsExpanded}
          initialTheme={themeUiPreferences.theme}
        />
      </Suspense>
    </>
  );
};

export default HomePage;
