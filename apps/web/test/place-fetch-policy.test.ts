import { describe, expect, it } from 'vitest';

import {
  getFavoritePlacesFetchPolicy,
  getPlaceMetricsFetchPolicy,
  getPlacesFetchPolicy,
} from '../lib/place-fetch-policy';

describe('place fetch policy', () => {
  it('keeps place lists in a short-lived cache', () => {
    expect(getPlacesFetchPolicy()).toEqual({
      cacheMode: 'force-cache',
      revalidateSeconds: 30,
    });
  });

  it('keeps favorite place requests in a short-lived cache', () => {
    expect(getFavoritePlacesFetchPolicy()).toEqual({
      cacheMode: 'force-cache',
      revalidateSeconds: 30,
    });
  });

  it('keeps place metrics short-lived in cache', () => {
    expect(getPlaceMetricsFetchPolicy()).toEqual({
      cacheMode: 'force-cache',
      revalidateSeconds: 60,
    });
  });
});
