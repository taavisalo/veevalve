import { describe, expect, it } from 'vitest';

import {
  LIVE_PLACE_CACHE_CONTROL,
  PLACE_METRICS_CACHE_CONTROL,
} from '../src/places/place-cache-control';

describe('place cache control', () => {
  it('keeps live place status responses cacheable for a short window', () => {
    expect(LIVE_PLACE_CACHE_CONTROL).toBe(
      'public, max-age=0, s-maxage=30, stale-while-revalidate=120',
    );
  });

  it('keeps aggregate metrics cacheable for a short window', () => {
    expect(PLACE_METRICS_CACHE_CONTROL).toBe(
      'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    );
  });
});
