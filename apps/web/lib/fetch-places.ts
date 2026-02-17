import {
  mapPlaceApiRows,
  type PlaceApiRow,
  type PlaceType,
  type PlaceWithLatestReading,
  type QualityStatus,
} from '@veevalve/core/client';

interface FetchPlacesOptions {
  locale: 'et' | 'en';
  type?: PlaceType;
  status?: QualityStatus;
  search?: string;
  limit?: number;
  signal?: AbortSignal;
  cacheMode?: RequestCache;
  revalidateSeconds?: number;
}

interface FetchPlacesByIdsOptions {
  locale: 'et' | 'en';
  ids: string[];
  signal?: AbortSignal;
  cacheMode?: RequestCache;
  revalidateSeconds?: number;
}

export interface PlaceMetrics {
  totalEntries: number;
  poolEntries: number;
  beachEntries: number;
  badQualityEntries: number;
  goodQualityEntries: number;
  unknownQualityEntries: number;
  badPoolEntries: number;
  badBeachEntries: number;
  updatedWithin24hEntries: number;
  staleOver7dEntries: number;
  latestSourceUpdatedAt: string | null;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_PLACE_METRICS: PlaceMetrics = {
  totalEntries: 0,
  poolEntries: 0,
  beachEntries: 0,
  badQualityEntries: 0,
  goodQualityEntries: 0,
  unknownQualityEntries: 0,
  badPoolEntries: 0,
  badBeachEntries: 0,
  updatedWithin24hEntries: 0,
  staleOver7dEntries: 0,
  latestSourceUpdatedAt: null,
};

const normalizePlaceMetrics = (raw: Partial<PlaceMetrics>): PlaceMetrics => {
  return {
    totalEntries:
      typeof raw.totalEntries === 'number' && Number.isFinite(raw.totalEntries)
        ? raw.totalEntries
        : DEFAULT_PLACE_METRICS.totalEntries,
    poolEntries:
      typeof raw.poolEntries === 'number' && Number.isFinite(raw.poolEntries)
        ? raw.poolEntries
        : DEFAULT_PLACE_METRICS.poolEntries,
    beachEntries:
      typeof raw.beachEntries === 'number' && Number.isFinite(raw.beachEntries)
        ? raw.beachEntries
        : DEFAULT_PLACE_METRICS.beachEntries,
    badQualityEntries:
      typeof raw.badQualityEntries === 'number' && Number.isFinite(raw.badQualityEntries)
        ? raw.badQualityEntries
        : DEFAULT_PLACE_METRICS.badQualityEntries,
    goodQualityEntries:
      typeof raw.goodQualityEntries === 'number' && Number.isFinite(raw.goodQualityEntries)
        ? raw.goodQualityEntries
        : DEFAULT_PLACE_METRICS.goodQualityEntries,
    unknownQualityEntries:
      typeof raw.unknownQualityEntries === 'number' && Number.isFinite(raw.unknownQualityEntries)
        ? raw.unknownQualityEntries
        : DEFAULT_PLACE_METRICS.unknownQualityEntries,
    badPoolEntries:
      typeof raw.badPoolEntries === 'number' && Number.isFinite(raw.badPoolEntries)
        ? raw.badPoolEntries
        : DEFAULT_PLACE_METRICS.badPoolEntries,
    badBeachEntries:
      typeof raw.badBeachEntries === 'number' && Number.isFinite(raw.badBeachEntries)
        ? raw.badBeachEntries
        : DEFAULT_PLACE_METRICS.badBeachEntries,
    updatedWithin24hEntries:
      typeof raw.updatedWithin24hEntries === 'number' && Number.isFinite(raw.updatedWithin24hEntries)
        ? raw.updatedWithin24hEntries
        : DEFAULT_PLACE_METRICS.updatedWithin24hEntries,
    staleOver7dEntries:
      typeof raw.staleOver7dEntries === 'number' && Number.isFinite(raw.staleOver7dEntries)
        ? raw.staleOver7dEntries
        : DEFAULT_PLACE_METRICS.staleOver7dEntries,
    latestSourceUpdatedAt:
      typeof raw.latestSourceUpdatedAt === 'string' ? raw.latestSourceUpdatedAt : null,
  };
};

const resolveApiBaseUrl = (): string => {
  const rawBaseUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:3001';
  return rawBaseUrl.replace(/\/+$/, '');
};

type NextFetchRequestInit = RequestInit & {
  next?: {
    revalidate: number;
  };
};

const buildRequestInit = ({
  signal,
  cacheMode,
  revalidateSeconds,
}: {
  signal?: AbortSignal;
  cacheMode?: RequestCache;
  revalidateSeconds?: number;
}): NextFetchRequestInit => {
  const init: NextFetchRequestInit = {};

  if (signal) {
    init.signal = signal;
  }

  if (cacheMode) {
    init.cache = cacheMode;
  }

  if (typeof revalidateSeconds === 'number') {
    init.next = { revalidate: revalidateSeconds };
  }

  return init;
};

export const fetchPlaces = async ({
  locale,
  type,
  status,
  search,
  limit = search?.trim() ? 20 : DEFAULT_LIMIT,
  signal,
  cacheMode = 'no-store',
  revalidateSeconds,
}: FetchPlacesOptions): Promise<PlaceWithLatestReading[]> => {
  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  params.set('locale', locale);
  params.set('limit', String(limit));
  params.set('sort', 'LATEST');

  if (type) {
    params.set('type', type);
  }

  if (status) {
    params.set('status', status);
  }

  if (search) {
    params.set('search', search);
  }

  const response = await fetch(
    `${baseUrl}/places?${params.toString()}`,
    buildRequestInit({
      signal,
      cacheMode,
      revalidateSeconds,
    }),
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch places: ${response.status}`);
  }

  const rows = (await response.json()) as PlaceApiRow[];
  return mapPlaceApiRows(rows);
};

export const fetchPlacesByIds = async ({
  locale,
  ids,
  signal,
  cacheMode = 'no-store',
  revalidateSeconds,
}: FetchPlacesByIdsOptions): Promise<PlaceWithLatestReading[]> => {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))].slice(0, 50);
  if (uniqueIds.length === 0) {
    return [];
  }

  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  params.set('locale', locale);
  for (const id of uniqueIds) {
    params.append('ids', id);
  }

  const response = await fetch(
    `${baseUrl}/places/by-ids?${params.toString()}`,
    buildRequestInit({
      signal,
      cacheMode,
      revalidateSeconds,
    }),
  );

  if (!response.ok) {
    return [];
  }

  const rows = (await response.json()) as PlaceApiRow[];
  return mapPlaceApiRows(rows);
};

export const fetchPlaceMetrics = async ({
  cacheMode = 'no-store',
  revalidateSeconds,
}: {
  cacheMode?: RequestCache;
  revalidateSeconds?: number;
} = {}): Promise<PlaceMetrics> => {
  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(
      `${baseUrl}/places/metrics`,
      buildRequestInit({
        cacheMode,
        revalidateSeconds,
      }),
    );

    if (!response.ok) {
      return DEFAULT_PLACE_METRICS;
    }

    const payload = (await response.json()) as Partial<PlaceMetrics>;
    return normalizePlaceMetrics(payload);
  } catch {
    return DEFAULT_PLACE_METRICS;
  }
};
