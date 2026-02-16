import {
  mapPlaceApiRows,
  type AppLocale,
  type PlaceApiRow,
  type PlaceType,
  type PlaceWithLatestReading,
  type QualityStatus,
} from '@veevalve/core';

interface FetchPlacesOptions {
  locale: AppLocale;
  type?: PlaceType;
  status?: QualityStatus;
  search?: string;
  limit?: number;
  signal?: AbortSignal;
}

const DEFAULT_LIMIT = 10;

const resolveApiBaseUrl = (): string => {
  const rawBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:3001/api';

  return rawBaseUrl.replace(/\/+$/, '');
};

export const fetchPlaces = async ({
  locale,
  type,
  status,
  search,
  limit = DEFAULT_LIMIT,
  signal,
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
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch places: ${response.status}`);
  }

  const rows = (await response.json()) as PlaceApiRow[];
  return mapPlaceApiRows(rows);
};
