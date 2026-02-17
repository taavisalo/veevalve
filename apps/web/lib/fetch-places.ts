import {
  mapPlaceApiRows,
  type PlaceApiRow,
  type PlaceType,
  type PlaceWithLatestReading,
  type QualityStatus,
} from '@veevalve/core/client';

import { buildRequestInit, resolveApiBaseUrl } from './api-request';

interface FetchPlacesOptions {
  locale: 'et' | 'en';
  type?: PlaceType;
  status?: QualityStatus;
  search?: string;
  limit?: number;
  signal?: AbortSignal;
  cacheMode?: RequestCache;
  revalidateSeconds?: number;
  includeBadDetails?: boolean;
}

const DEFAULT_LIMIT = 10;

export const fetchPlaces = async ({
  locale,
  type,
  status,
  search,
  limit = search?.trim() ? 20 : DEFAULT_LIMIT,
  signal,
  cacheMode = 'no-store',
  revalidateSeconds,
  includeBadDetails = true,
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
  params.set('includeBadDetails', includeBadDetails ? 'true' : 'false');

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
