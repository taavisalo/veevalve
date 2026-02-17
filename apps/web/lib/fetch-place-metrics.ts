import { buildRequestInit, resolveApiBaseUrl } from './api-request';

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

export const EMPTY_PLACE_METRICS: PlaceMetrics = {
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
        : EMPTY_PLACE_METRICS.totalEntries,
    poolEntries:
      typeof raw.poolEntries === 'number' && Number.isFinite(raw.poolEntries)
        ? raw.poolEntries
        : EMPTY_PLACE_METRICS.poolEntries,
    beachEntries:
      typeof raw.beachEntries === 'number' && Number.isFinite(raw.beachEntries)
        ? raw.beachEntries
        : EMPTY_PLACE_METRICS.beachEntries,
    badQualityEntries:
      typeof raw.badQualityEntries === 'number' && Number.isFinite(raw.badQualityEntries)
        ? raw.badQualityEntries
        : EMPTY_PLACE_METRICS.badQualityEntries,
    goodQualityEntries:
      typeof raw.goodQualityEntries === 'number' && Number.isFinite(raw.goodQualityEntries)
        ? raw.goodQualityEntries
        : EMPTY_PLACE_METRICS.goodQualityEntries,
    unknownQualityEntries:
      typeof raw.unknownQualityEntries === 'number' && Number.isFinite(raw.unknownQualityEntries)
        ? raw.unknownQualityEntries
        : EMPTY_PLACE_METRICS.unknownQualityEntries,
    badPoolEntries:
      typeof raw.badPoolEntries === 'number' && Number.isFinite(raw.badPoolEntries)
        ? raw.badPoolEntries
        : EMPTY_PLACE_METRICS.badPoolEntries,
    badBeachEntries:
      typeof raw.badBeachEntries === 'number' && Number.isFinite(raw.badBeachEntries)
        ? raw.badBeachEntries
        : EMPTY_PLACE_METRICS.badBeachEntries,
    updatedWithin24hEntries:
      typeof raw.updatedWithin24hEntries === 'number' && Number.isFinite(raw.updatedWithin24hEntries)
        ? raw.updatedWithin24hEntries
        : EMPTY_PLACE_METRICS.updatedWithin24hEntries,
    staleOver7dEntries:
      typeof raw.staleOver7dEntries === 'number' && Number.isFinite(raw.staleOver7dEntries)
        ? raw.staleOver7dEntries
        : EMPTY_PLACE_METRICS.staleOver7dEntries,
    latestSourceUpdatedAt:
      typeof raw.latestSourceUpdatedAt === 'string' ? raw.latestSourceUpdatedAt : null,
  };
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
      return EMPTY_PLACE_METRICS;
    }

    const payload = (await response.json()) as Partial<PlaceMetrics>;
    return normalizePlaceMetrics(payload);
  } catch {
    return EMPTY_PLACE_METRICS;
  }
};
