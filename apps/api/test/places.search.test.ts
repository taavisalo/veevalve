import { describe, expect, it, vi } from 'vitest';

import { PlacesService } from '../src/places/places.service';

const createPrismaMock = () => ({
  $queryRaw: vi.fn(),
  place: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  placeLatestStatus: {
    findMany: vi.fn(),
  },
  waterQualityIndicator: {
    findMany: vi.fn(),
  },
  waterQualityProtocol: {
    findMany: vi.fn(),
  },
});

describe('PlacesService search ranking', () => {
  it('retries compact single-token search with relaxed fuzzy threshold when first pass returns no matches', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'place-1' }])
      .mockResolvedValueOnce([{ id: 'place-2' }, { id: 'place-1' }]);
    prisma.place.findMany.mockResolvedValue([
      {
        id: 'place-1',
        externalId: 'ext-1',
        type: 'POOL',
        nameEt: 'SPA Georg Ots veekeskus minibassein',
        nameEn: 'SPA Georg Ots veekeskus minibassein',
        municipality: 'Saaremaa vald',
        addressEt: 'Tori tn 2',
        addressEn: 'Tori tn 2',
        latitude: null,
        longitude: null,
        latestStatus: {
          sampleId: 'sample-1',
          sampledAt: new Date('2025-01-01T00:00:00.000Z'),
          status: 'GOOD',
          statusReasonEt: 'Hea',
          statusReasonEn: 'Good',
        },
        samplingPoints: [
          {
            name: 'GO minibassein',
            address: 'Tori tn 2',
          },
        ],
      },
      {
        id: 'place-2',
        externalId: 'ext-2',
        type: 'POOL',
        nameEt: 'SPA Georg Ots veekeskus mullivann',
        nameEn: 'SPA Georg Ots veekeskus mullivann',
        municipality: 'Saaremaa vald',
        addressEt: 'Tori tn 2',
        addressEn: 'Tori tn 2',
        latitude: null,
        longitude: null,
        latestStatus: {
          sampleId: 'sample-2',
          sampledAt: new Date('2025-01-02T00:00:00.000Z'),
          status: 'GOOD',
          statusReasonEt: 'Hea',
          statusReasonEn: 'Good',
        },
        samplingPoints: [
          {
            name: 'Mullivann',
            address: 'Tori tn 2',
          },
        ],
      },
    ]);

    const service = new PlacesService(prisma as never);
    const rows = await service.listPlaces({
      search: 'gospa',
      locale: 'et',
      includeBadDetails: false,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('place-1');
    expect(rows[1]?.id).toBe('place-2');
    expect(rows[0]?.name).toBe('SPA Georg Ots veekeskus minibassein');
  });

  it('does not run relaxed fallback for multi-word queries', async () => {
    const prisma = createPrismaMock();
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const service = new PlacesService(prisma as never);
    const rows = await service.listPlaces({
      search: 'georg ots',
      locale: 'et',
      includeBadDetails: false,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(rows).toEqual([]);
  });
});
