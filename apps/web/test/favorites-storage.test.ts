import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlaceWithLatestReading } from '@veevalve/core/client';
import {
  parseFavoritePlaceIds,
  readCachedFavoritePlaces,
  readFavoritePlaceIds,
  writeCachedFavoritePlaces,
  writeFavoritePlaceIds,
} from '../lib/favorites-storage';

const FAVORITES_LOCAL_STORAGE_KEY = 'veevalve.favorite_place_ids.v1';
const FAVORITE_PLACES_CACHE_LOCAL_STORAGE_KEY = 'veevalve.favorite_places.v1';

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

const createCachedPlace = (
  id: string,
  status: NonNullable<PlaceWithLatestReading['latestReading']>['status'] = 'GOOD',
): PlaceWithLatestReading => ({
  id,
  externalId: `external-${id}`,
  nameEt: `Koht ${id}`,
  nameEn: `Place ${id}`,
  type: 'BEACH',
  addressEt: `Aadress ${id}`,
  latitude: 59.437,
  longitude: 24.7536,
  municipality: 'Tallinn',
  latestReading: {
    id: `reading-${id}`,
    placeId: id,
    sampledAt: '2026-07-03T09:00:00.000Z',
    status,
    statusReasonEt: 'Hea suplusvee kvaliteet',
    statusReasonEn: 'Good bathing water quality',
    source: 'TERVISEAMET_XML',
    sourceUrl: 'https://example.com/source.xml',
  },
});

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

  it('reads cached favorite places in current favorite order', () => {
    const place1 = createCachedPlace('place-1');
    const place2 = createCachedPlace('place-2', 'UNKNOWN');
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });

    writeCachedFavoritePlaces([place2, place1]);

    expect(readCachedFavoritePlaces(['place-1', 'missing-place', 'place-2'])).toEqual([
      place1,
      place2,
    ]);
  });

  it('filters invalid cached favorite entries', () => {
    const place = createCachedPlace('place-1');
    const storage = createMemoryStorage(
      new Map([
        [
          FAVORITE_PLACES_CACHE_LOCAL_STORAGE_KEY,
          JSON.stringify([place, { id: 'place-2', nameEt: 'Missing required fields' }]),
        ],
      ]),
    );
    vi.stubGlobal('window', { localStorage: storage });

    expect(readCachedFavoritePlaces(['place-2', 'place-1'])).toEqual([place]);
  });

  it('removes the cached favorite place payload when no places remain', () => {
    const storage = createMemoryStorage(
      new Map([[FAVORITE_PLACES_CACHE_LOCAL_STORAGE_KEY, JSON.stringify([createCachedPlace('a')])]]),
    );
    vi.stubGlobal('window', { localStorage: storage });

    writeCachedFavoritePlaces([]);

    expect(storage.getItem(FAVORITE_PLACES_CACHE_LOCAL_STORAGE_KEY)).toBeNull();
  });
});
