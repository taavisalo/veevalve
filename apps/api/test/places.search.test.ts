import { BadRequestException } from '@nestjs/common';
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

  it('returns distance-sorted places in ranked order', async () => {
    const prisma = createPrismaMock();
    prisma.place.findMany.mockResolvedValue([
      {
        id: 'far-place',
        externalId: 'ext-2',
        type: 'BEACH',
        nameEt: 'Pirita rand',
        nameEn: 'Pirita Beach',
        municipality: 'Tallinn',
        addressEt: 'Merivälja tee 1',
        addressEn: 'Merivälja tee 1',
        coordinateX: null,
        coordinateY: null,
        latitude: 59.4697,
        longitude: 24.8405,
        latestStatus: {
          sampleId: 'sample-2',
          sampledAt: new Date('2025-01-02T00:00:00.000Z'),
          status: 'GOOD',
          statusReasonEt: 'Hea',
          statusReasonEn: 'Good',
        },
      },
      {
        id: 'near-place',
        externalId: 'ext-1',
        type: 'POOL',
        nameEt: 'Kalev Spa bassein',
        nameEn: 'Kalev Spa Pool',
        municipality: 'Tallinn',
        addressEt: 'Aia 18',
        addressEn: 'Aia 18',
        coordinateX: null,
        coordinateY: null,
        latitude: 59.4404,
        longitude: 24.7525,
        latestStatus: {
          sampleId: 'sample-1',
          sampledAt: new Date('2025-01-01T00:00:00.000Z'),
          status: 'GOOD',
          statusReasonEt: 'Hea',
          statusReasonEn: 'Good',
        },
      },
    ]);

    const service = new PlacesService(prisma as never);
    const rows = await service.listPlaces({
      sort: 'DISTANCE',
      nearLatitude: 59.437,
      nearLongitude: 24.753,
      locale: 'et',
      includeBadDetails: false,
    });

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.place.findMany).toHaveBeenCalledTimes(1);
    expect(rows.map((row) => row.id)).toEqual(['near-place', 'far-place']);
  });

  it('uses raw L-EST97 coordinates as a distance fallback', async () => {
    const prisma = createPrismaMock();
    prisma.place.findMany.mockResolvedValue([
      {
        id: 'inglirand',
        externalId: '462',
        type: 'BEACH',
        nameEt: 'Inglirand',
        nameEn: 'Inglirand',
        municipality: 'Tallinn',
        addressEt: 'Kesklinna linnaosa, Tallinn',
        addressEn: 'Kesklinna linnaosa, Tallinn',
        coordinateX: 6589950.426,
        coordinateY: 544949.103,
        latitude: null,
        longitude: null,
        latestStatus: {
          sampleId: 'sample-1',
          sampledAt: new Date('2025-01-01T00:00:00.000Z'),
          status: 'BAD',
          statusReasonEt: 'Halb',
          statusReasonEn: 'Bad',
        },
      },
    ]);

    const service = new PlacesService(prisma as never);
    const rows = await service.listPlaces({
      sort: 'DISTANCE',
      nearLatitude: 59.445,
      nearLongitude: 24.7923,
      locale: 'et',
      includeBadDetails: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('inglirand');
    expect(rows[0]?.latitude).toBeCloseTo(59.444979, 6);
    expect(rows[0]?.longitude).toBeCloseTo(24.792305, 6);
  });

  it('rejects distance sorting without coordinates', async () => {
    const prisma = createPrismaMock();
    const service = new PlacesService(prisma as never);

    await expect(
      service.listPlaces({
        sort: 'DISTANCE',
        locale: 'et',
        includeBadDetails: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
