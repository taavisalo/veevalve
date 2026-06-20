import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  parseFavoritePlaceIds,
  readFavoritePlaceIds,
  writeFavoritePlaceIds,
} from '../lib/favorites-storage';

const FAVORITES_LOCAL_STORAGE_KEY = 'veevalve.favorite_place_ids.v1';

const createMemoryStorage = (initialValues: Map<string, string> = new Map()): Storage => {
  const values = new Map(initialValues);

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => {
      values.clear();
    }),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
};

describe('favorites storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a normalized fallback outside the browser', () => {
    expect(readFavoritePlaceIds(['place-1', ' ', 'place-1', 'place-2'])).toEqual([
      'place-1',
      'place-2',
    ]);
  });

  it('reads stored favorite IDs before falling back to server IDs', () => {
    const storage = createMemoryStorage(
      new Map([[FAVORITES_LOCAL_STORAGE_KEY, JSON.stringify(['local-1', 'local-2'])]]),
    );
    vi.stubGlobal('window', { localStorage: storage });

    expect(readFavoritePlaceIds(['server-1'])).toEqual(['local-1', 'local-2']);
  });

  it('parses encoded cookie favorite IDs', () => {
    expect(parseFavoritePlaceIds(encodeURIComponent(JSON.stringify(['a', 'b', 'a', ''])))).toEqual([
      'a',
      'b',
    ]);
  });

  it('writes normalized favorite IDs to local storage and the preferences endpoint', () => {
    const storage = createMemoryStorage();
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('fetch', fetchMock);

    writeFavoritePlaceIds(['place-1', 'place-2', 'place-1', '']);

    const expectedIds = ['place-1', 'place-2'];
    expect(JSON.parse(storage.getItem(FAVORITES_LOCAL_STORAGE_KEY) ?? '')).toEqual(expectedIds);
    expect(fetchMock).toHaveBeenCalledWith('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ favoritePlaceIds: expectedIds }),
      credentials: 'same-origin',
      keepalive: true,
    });
  });

  it('removes empty local storage favorites and syncs an empty cookie value', () => {
    const storage = createMemoryStorage(
      new Map([[FAVORITES_LOCAL_STORAGE_KEY, JSON.stringify(['place-1'])]]),
    );
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('fetch', fetchMock);

    writeFavoritePlaceIds([]);

    expect(storage.getItem(FAVORITES_LOCAL_STORAGE_KEY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/preferences',
      expect.objectContaining({
        body: JSON.stringify({ favoritePlaceIds: [] }),
      }),
    );
  });
});
