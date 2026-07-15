import { describe, expect, it } from 'vitest';

import {
  getFavoritePlacesFetchPolicy,
  getPlaceMetricsFetchPolicy,
  getPlacesFetchPolicy,
  shouldRevalidateInitialPlaces,
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

  it('revalidates an initial place payload after its cache window', () => {
    const referenceTimeMs = new Date('2026-07-15T12:00:00.000Z').getTime();

    expect(
      shouldRevalidateInitialPlaces('2026-07-15T11:59:31.000Z', referenceTimeMs),
    ).toBe(false);
    expect(
      shouldRevalidateInitialPlaces('2026-07-15T11:59:30.000Z', referenceTimeMs),
    ).toBe(true);
  });

  it('revalidates an initial place payload with an invalid generation time', () => {
    expect(shouldRevalidateInitialPlaces('not-a-date')).toBe(true);
  });
});
