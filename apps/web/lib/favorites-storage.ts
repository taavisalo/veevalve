const FAVORITES_STORAGE_KEY = 'veevalve.favorite_place_ids.v1';
export const FAVORITE_PLACE_IDS_COOKIE_NAME = '__Host-veevalve.favorite_place_ids.v1';
const MAX_FAVORITES = 50;

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
