import { Injectable, NotFoundException } from '@nestjs/common';
import type { Place, PlaceLatestStatus, PlaceType, QualityStatus } from '@prisma/client';
import { Prisma, SourceFileKind } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { ListPlacesQuery } from './dto/list-places.query';

export interface PlaceListResponse {
  id: string;
  externalId: string;
  type: PlaceType;
  name: string;
  municipality: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  latestReading?: {
    sampledAt: string;
    status: QualityStatus;
    statusReason: string;
  };
}

export interface PlaceMetricsResponse {
  totalEntries: number;
  poolEntries: number;
  beachEntries: number;
  badQualityEntries: number;
  goodQualityEntries: number;
  unknownQualityEntries: number;
  badPoolEntries: number;
  badBeachEntries: number;
  updatedWithin24hEntries: number;
  staleOver7dEntries: number;
  latestSourceUpdatedAt: string | null;
}

interface RankedPlaceId {
  id: string;
}

const DEFAULT_LIST_LIMIT = 10;
const SEARCH_LIST_LIMIT = 20;

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlaceMetrics(): Promise<PlaceMetricsResponse> {
    const sampleKinds = [SourceFileKind.POOL_SAMPLES, SourceFileKind.BEACH_SAMPLES];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalEntries,
      poolEntries,
      beachEntries,
      badQualityEntries,
      goodQualityEntries,
      unknownQualityEntries,
      badPoolEntries,
      badBeachEntries,
      updatedWithin24hEntries,
      staleOver7dEntries,
      latestChangedSampleFile,
      latestCheckedSampleFile,
    ] =
      await this.prisma.$transaction([
        this.prisma.placeLatestStatus.count(),
        this.prisma.placeLatestStatus.count({
          where: {
            place: {
              type: 'POOL',
            },
          },
        }),
        this.prisma.placeLatestStatus.count({
          where: {
            place: {
              type: 'BEACH',
            },
          },
        }),
        this.prisma.placeLatestStatus.count({
          where: {
            status: 'BAD',
          },
        }),
        this.prisma.placeLatestStatus.count({
          where: {
            status: 'GOOD',
          },
        }),
        this.prisma.placeLatestStatus.count({
          where: {
            status: 'UNKNOWN',
          },
        }),
        this.prisma.placeLatestStatus.count({
          where: {
            status: 'BAD',
            place: {
              type: 'POOL',
            },
          },
        }),
        this.prisma.placeLatestStatus.count({
          where: {
            status: 'BAD',
            place: {
              type: 'BEACH',
            },
          },
        }),
        this.prisma.placeLatestStatus.count({
          where: {
            sampledAt: {
              gte: oneDayAgo,
            },
          },
        }),
        this.prisma.placeLatestStatus.count({
          where: {
            sampledAt: {
              lt: sevenDaysAgo,
            },
          },
        }),
        this.prisma.sourceSyncState.findFirst({
          where: {
            fileKind: { in: sampleKinds },
            lastChangedAt: { not: null },
          },
          orderBy: { lastChangedAt: 'desc' },
          select: { lastChangedAt: true },
        }),
        this.prisma.sourceSyncState.findFirst({
          where: {
            fileKind: { in: sampleKinds },
            lastCheckedAt: { not: null },
          },
          orderBy: { lastCheckedAt: 'desc' },
          select: { lastCheckedAt: true },
        }),
      ]);

    const latestSourceUpdatedAt =
      latestChangedSampleFile?.lastChangedAt ?? latestCheckedSampleFile?.lastCheckedAt;

    return {
      totalEntries,
      poolEntries,
      beachEntries,
      badQualityEntries,
      goodQualityEntries,
      unknownQualityEntries,
      badPoolEntries,
      badBeachEntries,
      updatedWithin24hEntries,
      staleOver7dEntries,
      latestSourceUpdatedAt: latestSourceUpdatedAt ? latestSourceUpdatedAt.toISOString() : null,
    };
  }

  async listPlaces(query: ListPlacesQuery): Promise<PlaceListResponse[]> {
    const locale = query.locale ?? 'et';
    const search = query.search?.trim();
    const limit = query.limit ?? (search ? SEARCH_LIST_LIMIT : DEFAULT_LIST_LIMIT);
    const offset = query.offset ?? 0;

    if (search) {
      const rankedPlaceIds = await this.findRankedPlaceIds({
        search,
        type: query.type,
        status: query.status,
        limit,
        offset,
      });

      if (rankedPlaceIds) {
        if (rankedPlaceIds.length === 0) {
          return [];
        }

        const placeMap = new Map(
          (
            await this.prisma.place.findMany({
              where: {
                id: { in: rankedPlaceIds },
              },
              include: {
                latestStatus: true,
              },
            })
          ).map((place) => [place.id, place] as const),
        );

        return rankedPlaceIds
          .map((placeId) => placeMap.get(placeId))
          .filter((place): place is Place & { latestStatus: PlaceLatestStatus | null } => Boolean(place))
          .map((place) => this.toListResponse(place, locale));
      }
    }

    const orderBy: Prisma.PlaceOrderByWithRelationInput[] =
      query.sort === 'NAME'
        ? [{ nameEt: 'asc' }]
        : [{ latestStatus: { sampledAt: 'desc' } }, { nameEt: 'asc' }];

    const places = await this.prisma.place.findMany({
      where: {
        type: query.type,
        OR: search
          ? [
              { nameEt: { contains: search, mode: 'insensitive' } },
              { nameEn: { contains: search, mode: 'insensitive' } },
              { municipality: { contains: search, mode: 'insensitive' } },
              { addressEt: { contains: search, mode: 'insensitive' } },
              { addressEn: { contains: search, mode: 'insensitive' } },
              {
                samplingPoints: {
                  some: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { address: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ]
          : undefined,
        latestStatus: query.status
          ? {
              is: {
                status: query.status,
              },
            }
          : {
              isNot: null,
            },
      },
      include: {
        latestStatus: true,
      },
      skip: offset,
      take: limit,
      orderBy,
    });

    return places.map((place) => this.toListResponse(place, locale));
  }

  async getPlaceById(id: string): Promise<PlaceListResponse> {
    const place = await this.prisma.place.findUnique({
      where: { id },
      include: {
        latestStatus: true,
      },
    });

    if (!place) {
      throw new NotFoundException('Place not found');
    }

    return this.toListResponse(place, 'et');
  }

  private async findRankedPlaceIds(input: {
    search: string;
    type?: PlaceType;
    status?: QualityStatus;
    limit: number;
    offset: number;
  }): Promise<string[] | null> {
    const { search, type, status, limit, offset } = input;
    const threshold = search.length <= 3 ? 0.2 : 0.12;

    const typeFilter = type ? Prisma.sql`AND p.type = ${type}` : Prisma.empty;
    const statusFilter = status ? Prisma.sql`AND ls.status = ${status}` : Prisma.empty;

    try {
      const rankedRows = await this.prisma.$queryRaw<RankedPlaceId[]>(Prisma.sql`
        SELECT p.id
        FROM "Place" p
        INNER JOIN "PlaceLatestStatus" ls ON ls."placeId" = p.id
        LEFT JOIN LATERAL (
          SELECT
            MAX(similarity(lower(sp.name), lower(${search}))) AS "nameSimilarity",
            MAX(similarity(lower(coalesce(sp.address, '')), lower(${search}))) AS "addressSimilarity",
            MAX(CASE WHEN lower(sp.name) LIKE lower(${search}) || '%' THEN 1 ELSE 0 END) AS "namePrefixMatch",
            MAX(CASE WHEN lower(sp.name) LIKE '%' || lower(${search}) || '%' THEN 1 ELSE 0 END) AS "nameContainsMatch",
            MAX(CASE WHEN lower(coalesce(sp.address, '')) LIKE '%' || lower(${search}) || '%' THEN 1 ELSE 0 END) AS "addressContainsMatch"
          FROM "SamplingPoint" sp
          WHERE sp."placeId" = p.id
        ) spx ON TRUE
        WHERE (
          similarity(lower(p."nameEt"), lower(${search})) > ${threshold}
          OR similarity(lower(p."nameEn"), lower(${search})) > ${threshold}
          OR similarity(lower(p."municipality"), lower(${search})) > ${threshold}
          OR similarity(lower(coalesce(p."addressEt", '')), lower(${search})) > ${threshold}
          OR similarity(lower(coalesce(p."addressEn", '')), lower(${search})) > ${threshold}
          OR coalesce(spx."nameSimilarity", 0) > ${threshold}
          OR coalesce(spx."addressSimilarity", 0) > ${threshold}
          OR lower(p."nameEt") LIKE '%' || lower(${search}) || '%'
          OR lower(p."nameEn") LIKE '%' || lower(${search}) || '%'
          OR lower(p."municipality") LIKE '%' || lower(${search}) || '%'
          OR lower(coalesce(p."addressEt", '')) LIKE '%' || lower(${search}) || '%'
          OR lower(coalesce(p."addressEn", '')) LIKE '%' || lower(${search}) || '%'
          OR coalesce(spx."nameContainsMatch", 0) = 1
          OR coalesce(spx."addressContainsMatch", 0) = 1
        )
        ${typeFilter}
        ${statusFilter}
        ORDER BY (
          GREATEST(
            similarity(lower(p."nameEt"), lower(${search})) * 1.35,
            similarity(lower(p."nameEn"), lower(${search})) * 1.25,
            similarity(lower(p."municipality"), lower(${search})) * 1.0,
            similarity(lower(coalesce(p."addressEt", '')), lower(${search})) * 0.55,
            similarity(lower(coalesce(p."addressEn", '')), lower(${search})) * 0.55,
            coalesce(spx."nameSimilarity", 0) * 1.2,
            coalesce(spx."addressSimilarity", 0) * 0.4
          )
          + CASE WHEN lower(p."nameEt") LIKE lower(${search}) || '%' THEN 0.9 ELSE 0 END
          + CASE WHEN lower(p."nameEn") LIKE lower(${search}) || '%' THEN 0.8 ELSE 0 END
          + CASE WHEN lower(p."municipality") LIKE lower(${search}) || '%' THEN 0.45 ELSE 0 END
          + CASE WHEN lower(p."nameEt") LIKE '%' || lower(${search}) || '%' THEN 0.25 ELSE 0 END
          + CASE WHEN lower(p."nameEn") LIKE '%' || lower(${search}) || '%' THEN 0.2 ELSE 0 END
          + CASE WHEN coalesce(spx."namePrefixMatch", 0) = 1 THEN 0.75 ELSE 0 END
          + CASE WHEN coalesce(spx."nameContainsMatch", 0) = 1 THEN 0.3 ELSE 0 END
          + CASE WHEN coalesce(spx."addressContainsMatch", 0) = 1 THEN 0.1 ELSE 0 END
        ) DESC,
        ls."sampledAt" DESC,
        p."nameEt" ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      return rankedRows.map((row) => row.id);
    } catch {
      // Extension/index may not be applied yet; fall back to standard contains search.
      return null;
    }
  }

  private toListResponse(
    place: Place & { latestStatus: PlaceLatestStatus | null },
    locale: 'et' | 'en',
  ): PlaceListResponse {
    const latest = place.latestStatus;

    return {
      id: place.id,
      externalId: place.externalId,
      type: place.type,
      name: locale === 'en' ? place.nameEn : place.nameEt,
      municipality: place.municipality,
      address: locale === 'en' ? (place.addressEn ?? null) : (place.addressEt ?? null),
      latitude: place.latitude ?? null,
      longitude: place.longitude ?? null,
      latestReading: latest
        ? {
            sampledAt: latest.sampledAt.toISOString(),
            status: latest.status,
            statusReason:
              locale === 'en'
                ? (latest.statusReasonEn ?? latest.statusReasonEt ?? '')
                : (latest.statusReasonEt ?? latest.statusReasonEn ?? ''),
          }
        : undefined,
    };
  }
}
