import { describe, expect, it } from 'vitest';

import { filterPlaces } from '../lib/filter-places';
import { mockPlaces } from '../lib/mock-places';

describe('filterPlaces', () => {
  it('filters by type', () => {
    const results = filterPlaces({ places: mockPlaces, type: 'POOL' });
    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('POOL');
  });

  it('filters by status', () => {
    const results = filterPlaces({ places: mockPlaces, status: 'BAD' });
    expect(results).toHaveLength(1);
    expect(results[0]?.latestReading?.status).toBe('BAD');
  });
});
