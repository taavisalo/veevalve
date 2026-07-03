import type { PlaceType, PlaceWithLatestReading, QualityStatus } from '@veevalve/core/client';

const FAVORITES_STORAGE_KEY = 'veevalve.favorite_place_ids.v1';
const FAVORITE_PLACES_CACHE_KEY = 'veevalve.favorite_places.v1';
export const FAVORITE_PLACE_IDS_COOKIE_NAME = '__Host-veevalve.favorite_place_ids.v1';
const MAX_FAVORITES = 50;

const normalizePlaceType = (value: unknown): PlaceType | undefined => {
  return value === 'BEACH' || value === 'POOL' ? value : undefined;
};

const normalizeQualityStatus = (value: unknown): QualityStatus | undefined => {
  return value === 'GOOD' || value === 'BAD' || value === 'UNKNOWN' ? value : undefined;
};

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((item) => normalizeString(item))
    .filter((item): item is string => Boolean(item));
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const normalizeCachedFavoritePlace = (value: unknown): PlaceWithLatestReading | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Partial<PlaceWithLatestReading>;
  const id = normalizeString(candidate.id);
  const externalId = normalizeString(candidate.externalId);
  const nameEt = normalizeString(candidate.nameEt);
  const nameEn = normalizeString(candidate.nameEn);
  const type = normalizePlaceType(candidate.type);
  const municipality = normalizeString(candidate.municipality);
  const latitude = normalizeNumber(candidate.latitude);
  const longitude = normalizeNumber(candidate.longitude);

  if (
    !id ||
    !externalId ||
    !nameEt ||
    !nameEn ||
    !type ||
    !municipality ||
    latitude === undefined ||
    longitude === undefined
  ) {
    return undefined;
  }

  const place: PlaceWithLatestReading = {
    id,
    externalId,
    type,
    nameEt,
    nameEn,
    municipality,
    latitude,
    longitude,
  };

  const addressEt = normalizeString(candidate.addressEt);
  if (addressEt) {
    place.addressEt = addressEt;
  }

  const addressEn = normalizeString(candidate.addressEn);
  if (addressEn) {
    place.addressEn = addressEn;
  }

  const reading = candidate.latestReading;
  if (reading && typeof reading === 'object') {
    const sampledAt = normalizeString(reading.sampledAt);
    const status = normalizeQualityStatus(reading.status);
    const statusReasonEt = normalizeString(reading.statusReasonEt);
    const statusReasonEn = normalizeString(reading.statusReasonEn);
    const sourceUrl = normalizeString(reading.sourceUrl);

    if (sampledAt && status && statusReasonEt && statusReasonEn && sourceUrl) {
      place.latestReading = {
        id: normalizeString(reading.id) ?? `${id}-latest`,
        placeId: id,
        sampledAt,
        status,
        statusReasonEt,
        statusReasonEn,
        source: 'TERVISEAMET_XML',
        sourceUrl,
        badDetailsEt: normalizeStringArray(reading.badDetailsEt),
        badDetailsEn: normalizeStringArray(reading.badDetailsEn),
      };
    }
  }

  return place;
};

export const normalizeFavoritePlaceIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueIds = new Set<string>();
  for (const rawId of value) {
    if (typeof rawId !== 'string') {
      continue;
    }

    const id = rawId.trim();
    if (id.length === 0) {
      continue;
    }

    uniqueIds.add(id);
    if (uniqueIds.size >= MAX_FAVORITES) {
      break;
    }
  }

  return [...uniqueIds];
};

export const parseFavoritePlaceIds = (serialized?: string): string[] => {
  if (!serialized) {
    return [];
  }

  try {
    return normalizeFavoritePlaceIds(JSON.parse(serialized));
  } catch {
    try {
      return normalizeFavoritePlaceIds(JSON.parse(decodeURIComponent(serialized)));
    } catch {
      return [];
    }
  }
};

const writeFavoritePlaceIdsCookie = (ids: string[]): void => {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return;
  }

  try {
    void fetch('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ favoritePlaceIds: ids }),
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {
      // Ignore sync failures; local storage and in-memory UI state have already updated.
    });
  } catch {
    // Ignore storage failures (private mode / blocked requests).
  }
};

export const readFavoritePlaceIds = (fallbackIds: string[] = []): string[] => {
  if (typeof window === 'undefined') {
    return normalizeFavoritePlaceIds(fallbackIds);
  }

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return normalizeFavoritePlaceIds(fallbackIds);
    }

    return parseFavoritePlaceIds(raw);
  } catch {
    return normalizeFavoritePlaceIds(fallbackIds);
  }
};

export const writeFavoritePlaceIds = (ids: string[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeFavoritePlaceIds(ids);

  try {
    if (normalized.length === 0) {
      window.localStorage.removeItem(FAVORITES_STORAGE_KEY);
    } else {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // Ignore storage failures (private mode / quota).
  }

  writeFavoritePlaceIdsCookie(normalized);
};

export const readCachedFavoritePlaces = (favoriteIds: string[]): PlaceWithLatestReading[] => {
  const normalizedIds = normalizeFavoritePlaceIds(favoriteIds);
  if (typeof window === 'undefined' || normalizedIds.length === 0) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FAVORITE_PLACES_CACHE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const byId = new Map<string, PlaceWithLatestReading>();
    for (const item of parsed) {
      const place = normalizeCachedFavoritePlace(item);
      if (place) {
        byId.set(place.id, place);
      }
    }

    return normalizedIds
      .map((id) => byId.get(id))
      .filter((place): place is PlaceWithLatestReading => Boolean(place));
  } catch {
    return [];
  }
};

export const writeCachedFavoritePlaces = (places: PlaceWithLatestReading[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPlaces = places
    .map((place) => normalizeCachedFavoritePlace(place))
    .filter((place): place is PlaceWithLatestReading => Boolean(place))
    .slice(0, MAX_FAVORITES);

  try {
    if (normalizedPlaces.length === 0) {
      window.localStorage.removeItem(FAVORITE_PLACES_CACHE_KEY);
      return;
    }

    window.localStorage.setItem(FAVORITE_PLACES_CACHE_KEY, JSON.stringify(normalizedPlaces));
  } catch {
    // Ignore storage failures (private mode / quota).
  }
};
