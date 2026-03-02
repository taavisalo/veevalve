import { describe, expect, it } from 'vitest';

import {
  getFavoritePlacesFetchPolicy,
  getPlaceMetricsFetchPolicy,
  getPlacesFetchPolicy,
} from '../lib/place-fetch-policy';

describe('place fetch policy', () => {
  it('disables caching for place lists', () => {
    expect(getPlacesFetchPolicy()).toEqual({
      cacheMode: 'no-store',
    });
  });

  it('disables caching for favorite place requests', () => {
    expect(getFavoritePlacesFetchPolicy()).toEqual({
      cacheMode: 'no-store',
    });
  });

  it('keeps place metrics short-lived in cache', () => {
    expect(getPlaceMetricsFetchPolicy()).toEqual({
      cacheMode: 'force-cache',
      revalidateSeconds: 60,
    });
  });
});
