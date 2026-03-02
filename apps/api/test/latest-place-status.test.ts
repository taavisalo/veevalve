import { describe, expect, it } from 'vitest';

import { pickRepresentativeLatestSamples } from '../src/water-quality/latest-place-status';

describe('pickRepresentativeLatestSamples', () => {
  it('prefers the worst status when multiple rows share the latest sampling time', () => {
    const sampledAt = new Date('2025-12-17T00:00:00.000Z');

    const [latest] = pickRepresentativeLatestSamples([
      {
        id: 'sample-good',
        placeId: 'place-1',
        sampledAt,
        overallStatus: 'GOOD',
      },
      {
        id: 'sample-bad',
        placeId: 'place-1',
        sampledAt,
        overallStatus: 'BAD',
      },
    ]);

    expect(latest?.id).toBe('sample-bad');
    expect(latest?.overallStatus).toBe('BAD');
  });

  it('still prefers a newer sample over an older worse one', () => {
    const [latest] = pickRepresentativeLatestSamples([
      {
        id: 'sample-old-bad',
        placeId: 'place-1',
        sampledAt: new Date('2025-11-26T00:00:00.000Z'),
        overallStatus: 'BAD',
      },
      {
        id: 'sample-new-good',
        placeId: 'place-1',
        sampledAt: new Date('2025-12-17T00:00:00.000Z'),
        overallStatus: 'GOOD',
      },
    ]);

    expect(latest?.id).toBe('sample-new-good');
    expect(latest?.overallStatus).toBe('GOOD');
  });

  it('returns one representative row per place', () => {
    const samples = pickRepresentativeLatestSamples([
      {
        id: 'place-2-good',
        placeId: 'place-2',
        sampledAt: new Date('2025-12-17T00:00:00.000Z'),
        overallStatus: 'GOOD',
      },
      {
        id: 'place-1-bad',
        placeId: 'place-1',
        sampledAt: new Date('2025-12-17T00:00:00.000Z'),
        overallStatus: 'BAD',
      },
      {
        id: 'place-1-good',
        placeId: 'place-1',
        sampledAt: new Date('2025-12-17T00:00:00.000Z'),
        overallStatus: 'GOOD',
      },
    ]);

    expect(samples).toHaveLength(2);
    expect(samples[0]?.placeId).toBe('place-1');
    expect(samples[0]?.overallStatus).toBe('BAD');
    expect(samples[1]?.placeId).toBe('place-2');
  });
});
