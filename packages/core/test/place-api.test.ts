import { describe, expect, it } from 'vitest';

import { mapPlaceApiRows, type PlaceApiRow } from '../src/places/place-api';

describe('mapPlaceApiRows', () => {
  it('maps and normalizes bad details from API payload', () => {
    const rows: PlaceApiRow[] = [
      {
        id: 'place-1',
        externalId: '123',
        type: 'POOL',
        name: 'Kalev Spa',
        municipality: 'Tallinn',
        address: 'Aia 18',
        latitude: 59.437,
        longitude: 24.753,
        latestReading: {
          sampledAt: '2026-02-16T08:00:00.000Z',
          status: 'BAD',
          statusReason: 'Mittevastav',
          badDetails: [' Enterokokid: 250 pmu/100ml ', '', 'Enterokokid: 250 pmu/100ml'],
        },
      },
    ];

    const [mapped] = mapPlaceApiRows(rows);

    expect(mapped?.latestReading?.status).toBe('BAD');
    expect(mapped?.latestReading?.badDetailsEt).toEqual(['Enterokokid: 250 pmu/100ml']);
    expect(mapped?.latestReading?.badDetailsEn).toEqual(['Enterokokid: 250 pmu/100ml']);
  });

  it('leaves bad details undefined when source payload has none', () => {
    const rows: PlaceApiRow[] = [
      {
        id: 'place-2',
        externalId: '124',
        type: 'BEACH',
        name: 'Pirita rand',
        municipality: 'Tallinn',
        address: 'Pirita tee',
        latitude: 59.46,
        longitude: 24.84,
      },
    ];

    const [mapped] = mapPlaceApiRows(rows);

    expect(mapped?.latestReading).toBeUndefined();
  });
});
