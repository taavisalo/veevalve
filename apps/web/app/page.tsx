import type { AppLocale, PlaceType, QualityStatus } from '@veevalve/core/client';

import { PlacesBrowser } from '../components/places-browser';
import { EMPTY_PLACE_METRICS } from '../lib/fetch-place-metrics';
import { fetchPlaces } from '../lib/fetch-places';

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

const HomePage = async ({ searchParams }: HomePageProps) => {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const locale = normalizeLocale(readParam(resolvedSearchParams, 'locale'));
  const type = normalizeType(readParam(resolvedSearchParams, 'type'));
  const status = normalizeStatus(readParam(resolvedSearchParams, 'status'));
  const search = readParam(resolvedSearchParams, 'q')?.trim();
  const initialLimit = search ? 20 : 10;
  const initialNowIso = new Date().toISOString();
  const shouldCacheInitialPlaces = !search;

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
    <PlacesBrowser
      initialLocale={locale}
      initialType={type}
      initialStatus={status}
      initialSearch={search}
      initialPlaces={initialPlaces}
      initialNowIso={initialNowIso}
      initialMetrics={EMPTY_PLACE_METRICS}
    />
  );
};

export default HomePage;
