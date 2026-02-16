const FAVORITES_STORAGE_KEY = 'veevalve.favorite_place_ids.v1';
const MAX_FAVORITES = 50;

const normalizeFavoriteIds = (value: unknown): string[] => {
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

export const readFavoritePlaceIds = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return normalizeFavoriteIds(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const writeFavoritePlaceIds = (ids: string[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeFavoriteIds(ids);

  try {
    if (normalized.length === 0) {
      window.localStorage.removeItem(FAVORITES_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures (private mode / quota).
  }
};

