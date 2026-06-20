import { describe, expect, it } from 'vitest';

import {
  calculateDistanceMeters,
  findNearestByCoordinates,
  isValidGeoPoint,
} from '../src/geo/distance';

describe('geo distance helpers', () => {
  it('calculates zero distance for identical coordinates', () => {
    const point = { latitude: 59.437, longitude: 24.753 };

    expect(calculateDistanceMeters(point, point)).toBe(0);
  });

  it('sorts valid coordinates by distance and skips invalid points', () => {
    const origin = { latitude: 59.437, longitude: 24.753 };
    const results = findNearestByCoordinates(origin, [
      { id: 'pirita', latitude: 59.4697, longitude: 24.8405 },
      { id: 'same-place', latitude: 59.437, longitude: 24.753 },
      { id: 'missing', latitude: Number.NaN, longitude: 24.753 },
    ]);

    expect(results.map(({ item }) => item.id)).toEqual(['same-place', 'pirita']);
    expect(results[0]?.distanceMeters).toBe(0);
  });

  it('rejects coordinates outside latitude and longitude ranges', () => {
    expect(isValidGeoPoint({ latitude: 91, longitude: 24.753 })).toBe(false);
    expect(isValidGeoPoint({ latitude: 59.437, longitude: 181 })).toBe(false);
  });
});
