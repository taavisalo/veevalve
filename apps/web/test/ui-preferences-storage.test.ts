import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  parseMetricsUiPreferences,
  parsePlacesBrowserPreferences,
  writeMetricsUiPreferences,
  readPlacesBrowserPreferences,
  writePlacesBrowserPreferences,
} from '../lib/ui-preferences-storage';

const PLACES_BROWSER_LOCAL_STORAGE_KEY = 'veevalve.places_browser.v1';
const METRICS_LOCAL_STORAGE_KEY = 'veevalve.metrics_ui.v1';

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

describe('places browser preferences storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns defaults outside the browser', () => {
    expect(readPlacesBrowserPreferences()).toEqual({
      typeFilter: 'ALL',
      statusFilter: 'ALL',
      nearbySearchEnabled: false,
      favoritesVisible: true,
    });
  });

  it('reads stored filters and nearby mode', () => {
    const storage = createMemoryStorage(
      new Map([
        [
          PLACES_BROWSER_LOCAL_STORAGE_KEY,
          JSON.stringify({
            typeFilter: 'POOL',
            statusFilter: 'BAD',
            nearbySearchEnabled: true,
            favoritesVisible: false,
          }),
        ],
      ]),
    );
    vi.stubGlobal('window', { localStorage: storage });

    expect(readPlacesBrowserPreferences()).toEqual({
      typeFilter: 'POOL',
      statusFilter: 'BAD',
      nearbySearchEnabled: true,
      favoritesVisible: false,
    });
  });

  it('normalizes invalid stored filters', () => {
    const storage = createMemoryStorage(
      new Map([
        [
          PLACES_BROWSER_LOCAL_STORAGE_KEY,
          JSON.stringify({
            typeFilter: 'SPA',
            statusFilter: 'OK',
            nearbySearchEnabled: 'yes',
            favoritesVisible: 'no',
          }),
        ],
      ]),
    );
    vi.stubGlobal('window', { localStorage: storage });

    expect(readPlacesBrowserPreferences()).toEqual({
      typeFilter: 'ALL',
      statusFilter: 'ALL',
      nearbySearchEnabled: false,
      favoritesVisible: true,
    });
  });

  it('parses encoded cookie preferences', () => {
    expect(
      parsePlacesBrowserPreferences(
        encodeURIComponent(
          JSON.stringify({
            typeFilter: 'BEACH',
            statusFilter: 'GOOD',
            nearbySearchEnabled: true,
            favoritesVisible: false,
          }),
        ),
      ),
    ).toEqual({
      typeFilter: 'BEACH',
      statusFilter: 'GOOD',
      nearbySearchEnabled: true,
      favoritesVisible: false,
    });
  });

  it('parses encoded metrics cookie preferences', () => {
    expect(
      parseMetricsUiPreferences(
        encodeURIComponent(
          JSON.stringify({
            metricsVisible: true,
            metricsExpanded: true,
          }),
        ),
      ),
    ).toEqual({
      metricsVisible: true,
      metricsExpanded: true,
    });
  });

  it('writes normalized browser preferences to local storage and the preferences endpoint', () => {
    const storage = createMemoryStorage();
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('fetch', fetchMock);

    writePlacesBrowserPreferences({
      typeFilter: 'BEACH',
      statusFilter: 'UNKNOWN',
      nearbySearchEnabled: true,
      favoritesVisible: false,
    });

    const expectedPreferences = {
      typeFilter: 'BEACH',
      statusFilter: 'UNKNOWN',
      nearbySearchEnabled: true,
      favoritesVisible: false,
    };
    expect(JSON.parse(storage.getItem(PLACES_BROWSER_LOCAL_STORAGE_KEY) ?? '')).toEqual(
      expectedPreferences,
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ placesBrowser: expectedPreferences }),
      credentials: 'same-origin',
      keepalive: true,
    });
  });

  it('writes metrics preferences to local storage and the preferences endpoint', () => {
    const storage = createMemoryStorage();
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('fetch', fetchMock);

    writeMetricsUiPreferences({
      metricsVisible: true,
      metricsExpanded: true,
    });

    const expectedPreferences = {
      metricsVisible: true,
      metricsExpanded: true,
    };
    expect(JSON.parse(storage.getItem(METRICS_LOCAL_STORAGE_KEY) ?? '')).toEqual(
      expectedPreferences,
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metricsUi: expectedPreferences }),
      credentials: 'same-origin',
      keepalive: true,
    });
  });
});
