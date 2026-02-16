import type { PlaceType, PlaceWithLatestReading, QualityStatus } from '@veevalve/core';

import { mapPlaceApiRows, type PlaceApiRow } from './place-api';

interface FetchPlacesOptions {
  locale: 'et' | 'en';
  type?: PlaceType;
  status?: QualityStatus;
  search?: string;
  limit?: number;
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
    'http://localhost:3001/api';
  return rawBaseUrl.replace(/\/+$/, '');
};

export const fetchPlaces = async ({
  locale,
  type,
  status,
  search,
  limit = search?.trim() ? 20 : DEFAULT_LIMIT,
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

  const response = await fetch(`${baseUrl}/places?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch places: ${response.status}`);
  }

  const rows = (await response.json()) as PlaceApiRow[];
  return mapPlaceApiRows(rows);
};

export const fetchPlaceMetrics = async (): Promise<PlaceMetrics> => {
  const baseUrl = resolveApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/places/metrics`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return DEFAULT_PLACE_METRICS;
    }

    const payload = (await response.json()) as Partial<PlaceMetrics>;
    return normalizePlaceMetrics(payload);
  } catch {
    return DEFAULT_PLACE_METRICS;
  }
};
