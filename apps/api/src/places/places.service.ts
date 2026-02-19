import { Injectable, NotFoundException } from '@nestjs/common';
import type { PlaceType, QualityStatus } from '@prisma/client';
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
    badDetails?: string[];
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

interface CompactAliasRule {
  textPart: string;
  initialsPart: string;
}

interface MetricsAggregateRow {
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
}

interface SourceUpdateAggregateRow {
  latestChangedAt: Date | null;
  latestCheckedAt: Date | null;
}

interface LatestStatusRow {
  sampleId: string;
  sampledAt: Date;
  status: QualityStatus;
  statusReasonEt: string | null;
  statusReasonEn: string | null;
}

interface PlaceRow {
  id: string;
  externalId: string;
  type: PlaceType;
  nameEt: string;
  nameEn: string;
  municipality: string;
  addressEt: string | null;
  addressEn: string | null;
  latitude: number | null;
  longitude: number | null;
  latestStatus: LatestStatusRow | null;
  samplingPoints?: Array<{
    name: string;
    address: string | null;
  }>;
}

const DEFAULT_LIST_LIMIT = 10;
const SEARCH_LIST_LIMIT = 20;
const DEFAULT_FUZZY_THRESHOLD = 0.12;
const SHORT_QUERY_FUZZY_THRESHOLD = 0.2;
const RELAXED_COMPACT_FUZZY_THRESHOLD = 0.1;
const RELAXED_COMPACT_QUERY_MIN_LENGTH = 4;
const RELAXED_COMPACT_QUERY_MAX_LENGTH = 8;

const PLACE_LATEST_STATUS_SELECT = {
  sampleId: true,
  sampledAt: true,
  status: true,
  statusReasonEt: true,
  statusReasonEn: true,
} satisfies Prisma.PlaceLatestStatusSelect;

const PLACE_CORE_SELECT = {
  id: true,
  externalId: true,
  type: true,
  nameEt: true,
  nameEn: true,
  municipality: true,
  addressEt: true,
  addressEn: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.PlaceSelect;

const PLACE_BASE_SELECT = {
  ...PLACE_CORE_SELECT,
  latestStatus: {
    select: PLACE_LATEST_STATUS_SELECT,
  },
} satisfies Prisma.PlaceSelect;

const PLACE_WITH_SAMPLING_POINTS_SELECT = {
  ...PLACE_BASE_SELECT,
  samplingPoints: {
    select: {
      name: true,
      address: true,
    },
  },
} satisfies Prisma.PlaceSelect;

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlaceMetrics(): Promise<PlaceMetricsResponse> {
    const sampleKinds = [SourceFileKind.POOL_SAMPLES, SourceFileKind.BEACH_SAMPLES];
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [metricsRows, sourceRows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<MetricsAggregateRow[]>(Prisma.sql`
        SELECT
          COUNT(*)::int AS "totalEntries",
          COUNT(*) FILTER (WHERE p.type = 'POOL')::int AS "poolEntries",
          COUNT(*) FILTER (WHERE p.type = 'BEACH')::int AS "beachEntries",
          COUNT(*) FILTER (WHERE ls.status = 'BAD')::int AS "badQualityEntries",
          COUNT(*) FILTER (WHERE ls.status = 'GOOD')::int AS "goodQualityEntries",
          COUNT(*) FILTER (WHERE ls.status = 'UNKNOWN')::int AS "unknownQualityEntries",
          COUNT(*) FILTER (WHERE ls.status = 'BAD' AND p.type = 'POOL')::int AS "badPoolEntries",
          COUNT(*) FILTER (WHERE ls.status = 'BAD' AND p.type = 'BEACH')::int AS "badBeachEntries",
          COUNT(*) FILTER (WHERE ls."sampledAt" >= ${oneDayAgo})::int AS "updatedWithin24hEntries",
          COUNT(*) FILTER (WHERE ls."sampledAt" < ${sevenDaysAgo})::int AS "staleOver7dEntries"
        FROM "PlaceLatestStatus" ls
        INNER JOIN "Place" p ON p.id = ls."placeId"
      `),
      this.prisma.$queryRaw<SourceUpdateAggregateRow[]>(Prisma.sql`
        SELECT
          MAX("lastChangedAt") AS "latestChangedAt",
          MAX("lastCheckedAt") AS "latestCheckedAt"
        FROM "SourceSyncState"
        WHERE "fileKind" IN (${Prisma.join(sampleKinds)})
      `),
    ]);

    const metrics = metricsRows[0];
    const sourceUpdates = sourceRows[0];
    const latestSourceUpdatedAt = sourceUpdates?.latestChangedAt ?? sourceUpdates?.latestCheckedAt;

    return {
      totalEntries: metrics?.totalEntries ?? 0,
      poolEntries: metrics?.poolEntries ?? 0,
      beachEntries: metrics?.beachEntries ?? 0,
      badQualityEntries: metrics?.badQualityEntries ?? 0,
      goodQualityEntries: metrics?.goodQualityEntries ?? 0,
      unknownQualityEntries: metrics?.unknownQualityEntries ?? 0,
      badPoolEntries: metrics?.badPoolEntries ?? 0,
      badBeachEntries: metrics?.badBeachEntries ?? 0,
      updatedWithin24hEntries: metrics?.updatedWithin24hEntries ?? 0,
      staleOver7dEntries: metrics?.staleOver7dEntries ?? 0,
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
              select: PLACE_WITH_SAMPLING_POINTS_SELECT,
            })
          ).map((place) => [place.id, place as PlaceRow] as const),
        );

        const orderedPlaces = rankedPlaceIds
          .map((placeId) => placeMap.get(placeId))
          .filter((place): place is PlaceRow => Boolean(place));

        const strictlyFilteredPlaces = this.filterStrictSearchMatches(orderedPlaces, search);
        const responsePlaces = strictlyFilteredPlaces.length > 0
          ? strictlyFilteredPlaces
          : orderedPlaces;

        return this.toListResponsesWithBadDetails(responsePlaces, locale, query.includeBadDetails);
      }
    }

    if (!search && query.sort !== 'NAME') {
      const latestStatuses = await this.prisma.placeLatestStatus.findMany({
        where: {
          status: query.status,
          place: query.type
            ? {
                type: query.type,
              }
            : undefined,
        },
        select: {
          ...PLACE_LATEST_STATUS_SELECT,
          place: {
            select: PLACE_CORE_SELECT,
          },
        },
        skip: offset,
        take: limit,
        orderBy: [{ sampledAt: 'desc' }, { placeId: 'asc' }],
      });

      const places = latestStatuses.map(({ place, ...latestStatus }) => ({
        ...place,
        latestStatus,
      })) as PlaceRow[];

      return this.toListResponsesWithBadDetails(places, locale, query.includeBadDetails);
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
      select: PLACE_BASE_SELECT,
      skip: offset,
      take: limit,
      orderBy,
    });

    return this.toListResponsesWithBadDetails(places as PlaceRow[], locale, query.includeBadDetails);
  }

  async getPlaceById(id: string, locale: 'et' | 'en' = 'et'): Promise<PlaceListResponse> {
    const place = await this.prisma.place.findUnique({
      where: { id },
      select: PLACE_BASE_SELECT,
    });

    if (!place) {
      throw new NotFoundException('Place not found');
    }

    const [response] = await this.toListResponsesWithBadDetails([place], locale);
    if (!response) {
      throw new NotFoundException('Place not found');
    }

    return response;
  }

  async getPlacesByIds(
    ids: string[],
    locale: 'et' | 'en' = 'et',
    includeBadDetails = true,
  ): Promise<PlaceListResponse[]> {
    const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))].slice(0, 50);
    if (normalizedIds.length === 0) {
      return [];
    }

    const places = await this.prisma.place.findMany({
      where: {
        id: {
          in: normalizedIds,
        },
      },
      select: PLACE_BASE_SELECT,
    });

    const placeMap = new Map(places.map((place) => [place.id, place] as const));
    const orderedPlaces = normalizedIds
      .map((id) => placeMap.get(id))
      .filter((place): place is PlaceRow => Boolean(place));

    return this.toListResponsesWithBadDetails(orderedPlaces, locale, includeBadDetails);
  }

  private async findRankedPlaceIds(input: {
    search: string;
    type?: PlaceType;
    status?: QualityStatus;
    limit: number;
    offset: number;
  }): Promise<string[] | null> {
    const { search, type, status, limit, offset } = input;
    const threshold = search.length <= 3
      ? SHORT_QUERY_FUZZY_THRESHOLD
      : DEFAULT_FUZZY_THRESHOLD;
    const strictTokens = this.extractStrictSearchTokens(search);
    const shouldRunStrictSearch = search.includes(' ') || strictTokens.length >= 2;
    const compactAliasRules = this.extractCompactAliasRules(search);

    const typeFilter = type ? Prisma.sql`AND p.type = ${type}` : Prisma.empty;
    const statusFilter = status ? Prisma.sql`AND ls.status = ${status}` : Prisma.empty;

    if (shouldRunStrictSearch) {
      const strictRankedRows = await this.findStrictRankedPlaceIds({
        search,
        strictTokens,
        limit,
        offset,
        typeFilter,
        statusFilter,
      });

      if (strictRankedRows.length > 0) {
        return strictRankedRows;
      }
    }

    try {
      const rankedRows = await this.findFuzzyRankedPlaceRows({
        search,
        threshold,
        limit,
        offset,
        typeFilter,
        statusFilter,
      });
      let rankedIds = rankedRows.map((row) => row.id);

      if (rankedIds.length === 0 && this.shouldRunRelaxedCompactFuzzySearch(search)) {
        const relaxedRows = await this.findFuzzyRankedPlaceRows({
          search,
          threshold: RELAXED_COMPACT_FUZZY_THRESHOLD,
          limit,
          offset,
          typeFilter,
          statusFilter,
        });
        rankedIds = relaxedRows.map((row) => row.id);
      }

      if (compactAliasRules.length > 0 && rankedIds.length < limit) {
        const aliasIds = await this.findCompactAliasRankedPlaceIds({
          rules: compactAliasRules,
          limit,
          offset,
          typeFilter,
          statusFilter,
        });
        rankedIds = this.mergeRankedPlaceIds(rankedIds, aliasIds, limit);
      }

      if (rankedIds.length > 0) {
        return rankedIds;
      }

      return [];
    } catch {
      // Extension/index may not be applied yet; fall back to standard contains search.
      return null;
    }
  }

  private async findFuzzyRankedPlaceRows(input: {
    search: string;
    threshold: number;
    limit: number;
    offset: number;
    typeFilter: Prisma.Sql;
    statusFilter: Prisma.Sql;
  }): Promise<RankedPlaceId[]> {
    const { search, threshold, limit, offset, typeFilter, statusFilter } = input;

    return this.prisma.$queryRaw<RankedPlaceId[]>(Prisma.sql`
        WITH "candidatePlaceIds" AS (
          SELECT p.id
          FROM "Place" p
          WHERE (
            similarity(lower(p."nameEt"), lower(${search})) > ${threshold}
            OR similarity(lower(p."nameEn"), lower(${search})) > ${threshold}
            OR lower(p."nameEt") LIKE '%' || lower(${search}) || '%'
            OR lower(p."nameEn") LIKE '%' || lower(${search}) || '%'
            OR lower(p."municipality") LIKE '%' || lower(${search}) || '%'
            OR lower(coalesce(p."addressEt", '')) LIKE '%' || lower(${search}) || '%'
            OR lower(coalesce(p."addressEn", '')) LIKE '%' || lower(${search}) || '%'
          )
          UNION
          SELECT sp."placeId" AS id
          FROM "SamplingPoint" sp
          WHERE (
            similarity(lower(sp.name), lower(${search})) > ${threshold}
            OR lower(sp.name) LIKE '%' || lower(${search}) || '%'
            OR lower(coalesce(sp.address, '')) LIKE '%' || lower(${search}) || '%'
          )
        )
        SELECT p.id
        FROM "candidatePlaceIds" cp
        INNER JOIN "Place" p ON p.id = cp.id
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
        WHERE TRUE
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
  }

  private async findCompactAliasRankedPlaceIds(input: {
    rules: CompactAliasRule[];
    limit: number;
    offset: number;
    typeFilter: Prisma.Sql;
    statusFilter: Prisma.Sql;
  }): Promise<string[]> {
    const { rules, limit, offset, typeFilter, statusFilter } = input;
    if (rules.length === 0) {
      return [];
    }

    const aliasClauses = rules.map((rule) =>
      Prisma.sql`(
        (
          lower(p."nameEt") LIKE '%' || ${rule.textPart} || '%'
          OR lower(p."nameEn") LIKE '%' || ${rule.textPart} || '%'
        )
        AND coalesce(initials.value, '') LIKE '%' || ${rule.initialsPart} || '%'
      )`,
    );

    const rows = await this.prisma.$queryRaw<RankedPlaceId[]>(Prisma.sql`
      SELECT p.id
      FROM "Place" p
      INNER JOIN "PlaceLatestStatus" ls ON ls."placeId" = p.id
      LEFT JOIN LATERAL (
        SELECT string_agg(left(token, 1), '') AS value
        FROM regexp_split_to_table(
          regexp_replace(
            lower(p."nameEt" || ' ' || p."nameEn"),
            '[^[:alnum:]]+',
            ' ',
            'g'
          ),
          '\\s+'
        ) AS token
        WHERE token <> ''
      ) initials ON TRUE
      WHERE (${Prisma.join(aliasClauses, ' OR ')})
      ${typeFilter}
      ${statusFilter}
      ORDER BY ls."sampledAt" DESC, p."nameEt" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    return rows.map((row) => row.id);
  }

  private mergeRankedPlaceIds(primary: string[], secondary: string[], limit: number): string[] {
    const merged: string[] = [];
    const seen = new Set<string>();

    for (const placeId of [...primary, ...secondary]) {
      if (seen.has(placeId)) {
        continue;
      }
      seen.add(placeId);
      merged.push(placeId);
      if (merged.length >= limit) {
        break;
      }
    }

    return merged;
  }

  private shouldRunRelaxedCompactFuzzySearch(search: string): boolean {
    const normalizedSearch = search.trim().normalize('NFKC').toLowerCase();

    if (!normalizedSearch || normalizedSearch.includes(' ')) {
      return false;
    }

    if (!/^[\p{L}\p{N}]+$/u.test(normalizedSearch)) {
      return false;
    }

    return (
      normalizedSearch.length >= RELAXED_COMPACT_QUERY_MIN_LENGTH &&
      normalizedSearch.length <= RELAXED_COMPACT_QUERY_MAX_LENGTH
    );
  }

  private extractCompactAliasRules(search: string): CompactAliasRule[] {
    const normalizedSearch = search.trim().normalize('NFKC').toLowerCase();
    if (!normalizedSearch || normalizedSearch.includes(' ')) {
      return [];
    }

    if (!/^[\p{L}\p{N}]+$/u.test(normalizedSearch)) {
      return [];
    }

    if (
      normalizedSearch.length < RELAXED_COMPACT_QUERY_MIN_LENGTH ||
      normalizedSearch.length > 12
    ) {
      return [];
    }

    const rules = new Map<string, CompactAliasRule>();
    for (
      let splitIndex = 2;
      splitIndex <= normalizedSearch.length - 2;
      splitIndex += 1
    ) {
      const left = normalizedSearch.slice(0, splitIndex);
      const right = normalizedSearch.slice(splitIndex);

      if (left.length >= 3 && right.length >= 2 && right.length <= 3) {
        rules.set(`${left}|${right}`, {
          textPart: left,
          initialsPart: right,
        });
      }

      if (right.length >= 3 && left.length >= 2 && left.length <= 3) {
        rules.set(`${right}|${left}`, {
          textPart: right,
          initialsPart: left,
        });
      }
    }

    return [...rules.values()];
  }

  private async findStrictRankedPlaceIds(input: {
    search: string;
    strictTokens: string[];
    limit: number;
    offset: number;
    typeFilter: Prisma.Sql;
    statusFilter: Prisma.Sql;
  }): Promise<string[]> {
    const { search, strictTokens, limit, offset, typeFilter, statusFilter } = input;
    const searchableTextExpression = Prisma.sql`
      (
        lower(p."nameEt")
        || ' '
        || lower(p."nameEn")
        || ' '
        || lower(p."municipality")
        || ' '
        || lower(coalesce(p."addressEt", ''))
        || ' '
        || lower(coalesce(p."addressEn", ''))
        || ' '
        || coalesce(spx."searchBlob", '')
      )
    `;
    const tokenContainsClauses = strictTokens.map((token) =>
      Prisma.sql`${searchableTextExpression} LIKE '%' || ${token} || '%'`,
    );
    const allStrictTokensMatch = tokenContainsClauses.length
      ? Prisma.sql`(${Prisma.join(tokenContainsClauses, ' AND ')})`
      : Prisma.sql`FALSE`;

    const rankedRows = await this.prisma.$queryRaw<RankedPlaceId[]>(Prisma.sql`
      SELECT p.id
      FROM "Place" p
      INNER JOIN "PlaceLatestStatus" ls ON ls."placeId" = p.id
      LEFT JOIN LATERAL (
        SELECT
          MAX(CASE WHEN lower(sp.name) LIKE '%' || lower(${search}) || '%' THEN 1 ELSE 0 END) AS "nameContainsMatch",
          MAX(CASE WHEN lower(coalesce(sp.address, '')) LIKE '%' || lower(${search}) || '%' THEN 1 ELSE 0 END) AS "addressContainsMatch",
          STRING_AGG(
            lower(coalesce(sp.name, '')) || ' ' || lower(coalesce(sp.address, '')),
            ' '
          ) AS "searchBlob"
        FROM "SamplingPoint" sp
        WHERE sp."placeId" = p.id
      ) spx ON TRUE
      WHERE (
        lower(p."nameEt") LIKE '%' || lower(${search}) || '%'
        OR lower(p."nameEn") LIKE '%' || lower(${search}) || '%'
        OR lower(p."municipality") LIKE '%' || lower(${search}) || '%'
        OR lower(coalesce(p."addressEt", '')) LIKE '%' || lower(${search}) || '%'
        OR lower(coalesce(p."addressEn", '')) LIKE '%' || lower(${search}) || '%'
        OR coalesce(spx."nameContainsMatch", 0) = 1
        OR coalesce(spx."addressContainsMatch", 0) = 1
        OR ${allStrictTokensMatch}
      )
      ${typeFilter}
      ${statusFilter}
      ORDER BY (
        CASE WHEN lower(p."nameEt") LIKE lower(${search}) || '%' THEN 2.0 ELSE 0 END
        + CASE WHEN lower(p."nameEn") LIKE lower(${search}) || '%' THEN 1.8 ELSE 0 END
        + CASE WHEN lower(p."nameEt") LIKE '%' || lower(${search}) || '%' THEN 1.4 ELSE 0 END
        + CASE WHEN lower(p."nameEn") LIKE '%' || lower(${search}) || '%' THEN 1.2 ELSE 0 END
        + CASE WHEN coalesce(spx."nameContainsMatch", 0) = 1 THEN 1.0 ELSE 0 END
        + CASE WHEN lower(coalesce(p."addressEt", '')) LIKE '%' || lower(${search}) || '%' THEN 0.7 ELSE 0 END
        + CASE WHEN lower(coalesce(p."addressEn", '')) LIKE '%' || lower(${search}) || '%' THEN 0.6 ELSE 0 END
        + CASE WHEN coalesce(spx."addressContainsMatch", 0) = 1 THEN 0.4 ELSE 0 END
        + CASE WHEN ${allStrictTokensMatch} THEN 1.1 ELSE 0 END
      ) DESC,
      ls."sampledAt" DESC,
      p."nameEt" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    return rankedRows.map((row) => row.id);
  }

  private extractStrictSearchTokens(search: string): string[] {
    const parts = search
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu);

    if (!parts || parts.length === 0) {
      return [];
    }

    const uniqueTokens = new Set<string>();
    for (const token of parts) {
      if (token.length < 3) {
        continue;
      }
      uniqueTokens.add(token);
    }

    return [...uniqueTokens];
  }

  private filterStrictSearchMatches<
    T extends {
      nameEt: string;
      nameEn: string;
      municipality: string;
      addressEt: string | null;
      addressEn: string | null;
      samplingPoints?: Array<{ name: string; address: string | null }>;
    },
  >(places: T[], search: string): T[] {
    const normalizedSearch = search.trim().normalize('NFKC').toLowerCase();
    if (!normalizedSearch) {
      return places;
    }

    const strictTokens = this.extractStrictSearchTokens(normalizedSearch);
    const shouldUseStrictFiltering = normalizedSearch.includes(' ') || strictTokens.length >= 2;
    if (!shouldUseStrictFiltering) {
      return places;
    }

    return places.filter((place) => {
      const searchable = [
        place.nameEt,
        place.nameEn,
        place.municipality,
        place.addressEt ?? '',
        place.addressEn ?? '',
        ...(place.samplingPoints ?? []).flatMap((samplingPoint) => [
          samplingPoint.name,
          samplingPoint.address ?? '',
        ]),
      ]
        .join(' ')
        .normalize('NFKC')
        .toLowerCase();

      if (searchable.includes(normalizedSearch)) {
        return true;
      }

      return strictTokens.length > 0 && strictTokens.every((token) => searchable.includes(token));
    });
  }

  private toListResponse(
    place: PlaceRow,
    locale: 'et' | 'en',
    badDetailsBySampleId?: ReadonlyMap<string, string[]>,
  ): PlaceListResponse {
    const latest = place.latestStatus;
    const badDetails =
      latest?.status === 'BAD'
        ? badDetailsBySampleId?.get(latest.sampleId)?.filter((detail) => detail.trim().length > 0)
        : undefined;

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
            badDetails: badDetails && badDetails.length > 0 ? badDetails : undefined,
          }
        : undefined,
    };
  }

  private async toListResponsesWithBadDetails<
    T extends PlaceRow,
  >(
    places: T[],
    locale: 'et' | 'en',
    includeBadDetails = true,
  ): Promise<PlaceListResponse[]> {
    if (places.length === 0) {
      return [];
    }

    if (!includeBadDetails) {
      return places.map((place) => this.toListResponse(place, locale));
    }

    const badSampleIdSet = new Set<string>();
    for (const place of places) {
      const sampleId = place.latestStatus?.status === 'BAD' ? place.latestStatus.sampleId : null;
      if (sampleId) {
        badSampleIdSet.add(sampleId);
      }
    }

    if (badSampleIdSet.size === 0) {
      return places.map((place) => this.toListResponse(place, locale));
    }

    const badSampleIds = [...badSampleIdSet];
    const badDetailsBySampleId = await this.buildBadDetailsBySampleId(badSampleIds, locale);

    return places.map((place) => this.toListResponse(place, locale, badDetailsBySampleId));
  }

  private async buildBadDetailsBySampleId(
    sampleIds: string[],
    locale: 'et' | 'en',
  ): Promise<Map<string, string[]>> {
    const normalizedSampleIds = [...new Set(sampleIds.filter((sampleId) => sampleId.trim().length > 0))];
    if (normalizedSampleIds.length === 0) {
      return new Map();
    }

    const detailsBySampleId = new Map<string, Set<string>>();

    const indicatorRows = await this.prisma.waterQualityIndicator.findMany({
      where: {
        OR: [
          { assessmentStatus: 'BAD' },
          { assessmentRaw: { contains: 'ei vasta', mode: 'insensitive' } },
          { assessmentRaw: { contains: 'mittevastav', mode: 'insensitive' } },
          { assessmentRaw: { contains: 'not compliant', mode: 'insensitive' } },
        ],
        protocol: {
          sampleId: {
            in: normalizedSampleIds,
          },
        },
      },
      select: {
        name: true,
        valueRaw: true,
        unit: true,
        protocol: {
          select: {
            sampleId: true,
          },
        },
      },
      orderBy: [
        { protocol: { sampleId: 'asc' } },
        { protocol: { protocolOrder: 'asc' } },
        { indicatorOrder: 'asc' },
      ],
    });

    for (const indicator of indicatorRows) {
      const detail = this.formatIndicatorBadDetail({
        name: indicator.name,
        valueRaw: indicator.valueRaw,
        unit: indicator.unit,
      });
      if (!detail) {
        continue;
      }

      const existingDetails =
        detailsBySampleId.get(indicator.protocol.sampleId) ?? new Set<string>();
      existingDetails.add(detail);
      detailsBySampleId.set(indicator.protocol.sampleId, existingDetails);
    }

    const protocolRows = await this.prisma.waterQualityProtocol.findMany({
      where: {
        sampleId: {
          in: normalizedSampleIds,
        },
        assessmentStatus: 'BAD',
      },
      select: {
        sampleId: true,
        protocolNumber: true,
        assessmentRaw: true,
      },
      orderBy: [{ sampleId: 'asc' }, { protocolOrder: 'asc' }],
    });

    for (const protocol of protocolRows) {
      if ((detailsBySampleId.get(protocol.sampleId)?.size ?? 0) > 0) {
        continue;
      }

      const fallbackDetail = this.formatProtocolBadDetail(
        {
          protocolNumber: protocol.protocolNumber,
          assessmentRaw: protocol.assessmentRaw,
        },
        locale,
      );
      if (!fallbackDetail) {
        continue;
      }

      detailsBySampleId.set(protocol.sampleId, new Set([fallbackDetail]));
    }

    const result = new Map<string, string[]>();
    for (const [sampleId, details] of detailsBySampleId) {
      result.set(sampleId, [...details]);
    }

    return result;
  }

  private formatIndicatorBadDetail(input: {
    name: string;
    valueRaw: string | null;
    unit: string | null;
  }): string | null {
    const name = input.name.trim();
    if (!name) {
      return null;
    }

    const value = input.valueRaw?.trim() ?? '';
    const unit = input.unit?.trim() ?? '';
    const measurement = [value, unit].filter((part) => part.length > 0).join(' ');

    if (measurement) {
      return `${name}: ${measurement}`;
    }

    return name;
  }

  private formatProtocolBadDetail(
    input: {
      protocolNumber: string | null;
      assessmentRaw: string | null;
    },
    locale: 'et' | 'en',
  ): string | null {
    const assessment = input.assessmentRaw?.trim() ?? '';
    if (!assessment) {
      return null;
    }

    const protocolNumber = input.protocolNumber?.trim() ?? '';
    if (protocolNumber) {
      return locale === 'en'
        ? `Test protocol no. ${protocolNumber}: ${assessment}`
        : `Katseprotokoll nr ${protocolNumber}: ${assessment}`;
    }

    return locale === 'en' ? `Test protocol: ${assessment}` : `Katseprotokoll: ${assessment}`;
  }
}
