import { mapPlaceApiRows, type PlaceApiRow, type PlaceWithLatestReading } from '@veevalve/core/client';

import { buildRequestInit, resolveApiBaseUrl } from './api-request';

interface FetchPlacesByIdsOptions {
  locale: 'et' | 'en';
  ids: string[];
  signal?: AbortSignal;
  cacheMode?: RequestCache;
  revalidateSeconds?: number;
  includeBadDetails?: boolean;
}

export const fetchPlacesByIds = async ({
  locale,
  ids,
  signal,
  cacheMode = 'no-store',
  revalidateSeconds,
  includeBadDetails = true,
}: FetchPlacesByIdsOptions): Promise<PlaceWithLatestReading[]> => {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))].slice(0, 50);
  if (uniqueIds.length === 0) {
    return [];
  }

  const baseUrl = resolveApiBaseUrl();
  const params = new URLSearchParams();
  params.set('locale', locale);
  params.set('includeBadDetails', includeBadDetails ? 'true' : 'false');
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
