import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  type Place,
  type PlaceType,
  type QualityStatus,
  SourceFileKind,
} from '@prisma/client';
import {
  detectStatusChange,
  parseBeachLocationsXml,
  parseBeachSamplesXml,
  parsePoolFacilitiesXml,
  parsePoolLocationsXml,
  parsePoolSamplesXml,
  type ParsedCoordinate,
  type ParsedPoolLocation,
  type ParsedSamplingPoint,
  type ParsedWaterQualitySample,
} from '@veevalve/core';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_POOL_SAMPLES_URL_TEMPLATE =
  'https://vtiav.sm.ee/index.php/opendata/basseini_veeproovid_{year}.xml';
const DEFAULT_BEACH_SAMPLES_URL_TEMPLATE =
  'https://vtiav.sm.ee/index.php/opendata/supluskoha_veeproovid_{year}.xml';
const DEFAULT_POOL_LOCATIONS_URL =
  'https://vtiav.sm.ee/index.php/opendata/basseinid.xml';
const DEFAULT_POOL_FACILITIES_URL =
  'https://vtiav.sm.ee/index.php/opendata/ujulad.xml';
const DEFAULT_BEACH_LOCATIONS_URL =
  'https://vtiav.sm.ee/index.php/opendata/supluskohad.xml';
const DEFAULT_SAMPLE_YEARS_BACK = 1;
const UNKNOWN_MUNICIPALITY = 'Teadmata';
const DEFAULT_FEED_FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_FEED_BYTES = 10 * 1024 * 1024; // 10 MiB

interface FeedDescriptor {
  fileKind: SourceFileKind;
  year: number;
  url: string;
}

type FeedFetchResult =
  | { status: 'changed'; descriptor: FeedDescriptor; xml: string }
  | { status: 'not-modified'; descriptor: FeedDescriptor }
  | { status: 'not-found'; descriptor: FeedDescriptor }
  | { status: 'skipped'; descriptor: FeedDescriptor }
  | { status: 'error'; descriptor: FeedDescriptor; error: string };

interface SampleImportSummary {
  processed: number;
  inserted: number;
  affectedPlaceIds: Set<string>;
}

export interface SyncSummary {
  feedsChecked: number;
  feedsChanged: number;
  feedsUnchanged: number;
  feedsNotFound: number;
  feedsSkippedByInterval: number;
  metadataRowsProcessed: number;
  sampleRowsProcessed: number;
  sampleRowsInserted: number;
  statusChanges: number;
}

interface UpsertPlaceInput {
  type: PlaceType;
  externalId: string;
  nameEt: string;
  addressEt?: string;
  municipality?: string;
  coordinate?: ParsedCoordinate;
  sourceUrl?: string;
}

@Injectable()
export class WaterQualityService {
  private readonly logger = new Logger(WaterQualityService.name);
  private readonly placeCache = new Map<string, Place>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('15 * * * *')
  async scheduledSync(): Promise<void> {
    await this.syncFromTerviseamet({ force: false });
  }

  async syncFromTerviseamet(
    options: { force?: boolean } = {},
  ): Promise<SyncSummary> {
    this.placeCache.clear();

    const force = options.force ?? true;
    const summary: SyncSummary = {
      feedsChecked: 0,
      feedsChanged: 0,
      feedsUnchanged: 0,
      feedsNotFound: 0,
      feedsSkippedByInterval: 0,
      metadataRowsProcessed: 0,
      sampleRowsProcessed: 0,
      sampleRowsInserted: 0,
      statusChanges: 0,
    };

    const affectedPlaceIds = new Set<string>();

    for (const descriptor of this.buildFeedDescriptors()) {
      summary.feedsChecked += 1;
      const fetchResult = await this.fetchFeedIfChanged(descriptor, force);

      if (fetchResult.status === 'changed') {
        summary.feedsChanged += 1;
        if (descriptor.fileKind === SourceFileKind.POOL_FACILITIES) {
          const rows = parsePoolFacilitiesXml(fetchResult.xml);
          summary.metadataRowsProcessed += await this.importPoolFacilities(rows);
          continue;
        }

        if (descriptor.fileKind === SourceFileKind.POOL_LOCATIONS) {
          const rows = parsePoolLocationsXml(fetchResult.xml);
          summary.metadataRowsProcessed += await this.importPoolLocations(rows);
          continue;
        }

        if (descriptor.fileKind === SourceFileKind.BEACH_LOCATIONS) {
          const rows = parseBeachLocationsXml(fetchResult.xml);
          summary.metadataRowsProcessed += await this.importBeachLocations(rows);
          continue;
        }

        if (descriptor.fileKind === SourceFileKind.POOL_SAMPLES) {
          const rows = parsePoolSamplesXml(fetchResult.xml, descriptor.year, descriptor.url);
          const importSummary = await this.importSamples(rows);
          summary.sampleRowsProcessed += importSummary.processed;
          summary.sampleRowsInserted += importSummary.inserted;
          for (const placeId of importSummary.affectedPlaceIds) {
            affectedPlaceIds.add(placeId);
          }
          continue;
        }

        if (descriptor.fileKind === SourceFileKind.BEACH_SAMPLES) {
          const rows = parseBeachSamplesXml(fetchResult.xml, descriptor.year, descriptor.url);
          const importSummary = await this.importSamples(rows);
          summary.sampleRowsProcessed += importSummary.processed;
          summary.sampleRowsInserted += importSummary.inserted;
          for (const placeId of importSummary.affectedPlaceIds) {
            affectedPlaceIds.add(placeId);
          }
        }

        continue;
      }

      if (fetchResult.status === 'not-modified') {
        summary.feedsUnchanged += 1;
        continue;
      }

      if (fetchResult.status === 'not-found') {
        summary.feedsNotFound += 1;
        continue;
      }

      if (fetchResult.status === 'skipped') {
        summary.feedsSkippedByInterval += 1;
        continue;
      }

      this.logger.warn(
        `Skipping feed ${descriptor.fileKind} ${descriptor.year} after fetch error: ${fetchResult.error}`,
      );
    }

    summary.statusChanges = await this.refreshLatestStatuses(affectedPlaceIds);
    return summary;
  }

  private buildFeedDescriptors(): FeedDescriptor[] {
    const poolLocationsUrl =
      process.env.TERVISEAMET_POOL_LOCATIONS_URL ?? DEFAULT_POOL_LOCATIONS_URL;
    const poolFacilitiesUrl =
      process.env.TERVISEAMET_POOL_FACILITIES_URL ?? DEFAULT_POOL_FACILITIES_URL;
    const beachLocationsUrl =
      process.env.TERVISEAMET_BEACH_LOCATIONS_URL ?? DEFAULT_BEACH_LOCATIONS_URL;
    const poolSampleTemplate =
      process.env.TERVISEAMET_POOL_SAMPLES_URL_TEMPLATE ??
      DEFAULT_POOL_SAMPLES_URL_TEMPLATE;
    const beachSampleTemplate =
      process.env.TERVISEAMET_BEACH_SAMPLES_URL_TEMPLATE ??
      DEFAULT_BEACH_SAMPLES_URL_TEMPLATE;
    const yearsBack = this.readPositiveInteger(
      process.env.TERVISEAMET_SAMPLE_YEARS_BACK,
      DEFAULT_SAMPLE_YEARS_BACK,
    );

    const currentYear = new Date().getUTCFullYear();
    const years: number[] = [];
    for (let delta = 0; delta <= yearsBack; delta += 1) {
      years.push(currentYear - delta);
    }

    const descriptors: FeedDescriptor[] = [
      { fileKind: SourceFileKind.POOL_FACILITIES, year: 0, url: poolFacilitiesUrl },
      { fileKind: SourceFileKind.POOL_LOCATIONS, year: 0, url: poolLocationsUrl },
      { fileKind: SourceFileKind.BEACH_LOCATIONS, year: 0, url: beachLocationsUrl },
    ];

    for (const year of years) {
      descriptors.push({
        fileKind: SourceFileKind.POOL_SAMPLES,
        year,
        url: this.resolveYearlyUrl(poolSampleTemplate, year),
      });
      descriptors.push({
        fileKind: SourceFileKind.BEACH_SAMPLES,
        year,
        url: this.resolveYearlyUrl(beachSampleTemplate, year),
      });
    }

    return descriptors;
  }

  private resolveYearlyUrl(template: string, year: number): string {
    if (template.includes('{year}')) {
      return template.replaceAll('{year}', String(year));
    }

    if (template.endsWith('.xml')) {
      return template.replace(/\.xml$/, `_${String(year)}.xml`);
    }

    return `${template}_${String(year)}.xml`;
  }

  private readPositiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }

    return parsed;
  }

  private feedIntervalMs(fileKind: SourceFileKind): number {
    const hour = 60 * 60 * 1000;
    if (
      fileKind === SourceFileKind.POOL_LOCATIONS ||
      fileKind === SourceFileKind.POOL_FACILITIES ||
      fileKind === SourceFileKind.BEACH_LOCATIONS
    ) {
      return 24 * hour;
    }

    if (fileKind === SourceFileKind.POOL_SAMPLES) {
      return 2 * hour;
    }

    const month = new Date().getUTCMonth() + 1;
    const isBeachSeason = month >= 5 && month <= 10;
    return isBeachSeason ? 2 * hour : 24 * hour;
  }

  private async fetchFeedIfChanged(
    descriptor: FeedDescriptor,
    force: boolean,
  ): Promise<FeedFetchResult> {
    const state = await this.prisma.sourceSyncState.findUnique({
      where: {
        fileKind_year: {
          fileKind: descriptor.fileKind,
          year: descriptor.year,
        },
      },
    });

    if (!force && state?.lastCheckedAt) {
      const elapsed = Date.now() - state.lastCheckedAt.getTime();
      if (elapsed < this.feedIntervalMs(descriptor.fileKind)) {
        return { status: 'skipped', descriptor };
      }
    }

    const requestHeaders: Record<string, string> = {};
    if (state?.etag) {
      requestHeaders['If-None-Match'] = state.etag;
    }
    if (state?.lastModified) {
      requestHeaders['If-Modified-Since'] = state.lastModified;
    }

    let response: Response;
    try {
      const timeoutMs = Math.max(
        1,
        this.readPositiveInteger(
          process.env.TERVISEAMET_FETCH_TIMEOUT_MS,
          DEFAULT_FEED_FETCH_TIMEOUT_MS,
        ),
      );
      response = await fetch(descriptor.url, {
        headers: requestHeaders,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown network error';
      await this.recordFeedState({
        descriptor,
        statusCode: null,
        error: message,
      });
      return { status: 'error', descriptor, error: message };
    }

    if (response.status === 304) {
      await this.recordFeedState({
        descriptor,
        statusCode: 304,
        error: null,
      });
      return { status: 'not-modified', descriptor };
    }

    if (response.status === 404) {
      await this.recordFeedState({
        descriptor,
        statusCode: 404,
        error: 'Feed not found',
      });
      return { status: 'not-found', descriptor };
    }

    if (!response.ok) {
      const message = `Unexpected HTTP status ${String(response.status)}`;
      await this.recordFeedState({
        descriptor,
        statusCode: response.status,
        error: message,
      });
      return { status: 'error', descriptor, error: message };
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const isAllowedContentType =
      !contentType ||
      contentType.includes('xml') ||
      contentType.includes('text/plain') ||
      contentType.includes('application/octet-stream');
    if (!isAllowedContentType) {
      const message = `Unexpected feed content type: ${contentType}`;
      await this.recordFeedState({
        descriptor,
        statusCode: response.status,
        error: message,
      });
      return { status: 'error', descriptor, error: message };
    }

    const maxFeedBytes = Math.max(
      1,
      this.readPositiveInteger(
        process.env.TERVISEAMET_MAX_FEED_BYTES,
        DEFAULT_MAX_FEED_BYTES,
      ),
    );
    const contentLengthHeader = response.headers.get('content-length');
    const parsedLength = contentLengthHeader
      ? Number.parseInt(contentLengthHeader, 10)
      : Number.NaN;
    if (Number.isFinite(parsedLength) && parsedLength > maxFeedBytes) {
      const message = `Feed exceeds max allowed size (${String(maxFeedBytes)} bytes)`;
      await this.recordFeedState({
        descriptor,
        statusCode: response.status,
        error: message,
      });
      return { status: 'error', descriptor, error: message };
    }

    let xml: string;
    try {
      xml = await this.readResponseTextWithLimit(response, maxFeedBytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read feed response';
      await this.recordFeedState({
        descriptor,
        statusCode: response.status,
        error: message,
      });
      return { status: 'error', descriptor, error: message };
    }

    const contentHash = createHash('sha256').update(xml).digest('hex');
    const contentLength = Number.isFinite(parsedLength)
      ? parsedLength
      : Buffer.byteLength(xml, 'utf8');
    const changed = state?.contentHash !== contentHash;

    await this.recordFeedState({
      descriptor,
      statusCode: response.status,
      error: null,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      contentHash,
      contentLength,
      markChanged: changed,
    });

    if (!changed) {
      return { status: 'not-modified', descriptor };
    }

    return { status: 'changed', descriptor, xml };
  }

  private async readResponseTextWithLimit(
    response: Response,
    maxBytes: number,
  ): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      const byteLength = Buffer.byteLength(text, 'utf8');
      if (byteLength > maxBytes) {
        throw new Error(`Feed exceeds max allowed size (${String(maxBytes)} bytes)`);
      }
      return text;
    }

    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalLength += value.byteLength;
      if (totalLength > maxBytes) {
        await reader.cancel();
        throw new Error(`Feed exceeds max allowed size (${String(maxBytes)} bytes)`);
      }

      chunks.push(value);
    }

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new TextDecoder('utf-8').decode(merged);
  }

  private async recordFeedState(args: {
    descriptor: FeedDescriptor;
    statusCode: number | null;
    error: string | null;
    etag?: string | null;
    lastModified?: string | null;
    contentHash?: string;
    contentLength?: number;
    markChanged?: boolean;
  }): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.sourceSyncState.findUnique({
      where: {
        fileKind_year: {
          fileKind: args.descriptor.fileKind,
          year: args.descriptor.year,
        },
      },
    });

    await this.prisma.sourceSyncState.upsert({
      where: {
        fileKind_year: {
          fileKind: args.descriptor.fileKind,
          year: args.descriptor.year,
        },
      },
      update: {
        url: args.descriptor.url,
        lastStatusCode: args.statusCode ?? undefined,
        lastCheckedAt: now,
        lastChangedAt: args.markChanged ? now : undefined,
        lastError: args.error,
        etag:
          args.etag === undefined
            ? undefined
            : (args.etag ?? null),
        lastModified:
          args.lastModified === undefined
            ? undefined
            : (args.lastModified ?? null),
        contentHash: args.contentHash ?? undefined,
        contentLength: args.contentLength ?? undefined,
      },
      create: {
        fileKind: args.descriptor.fileKind,
        year: args.descriptor.year,
        url: args.descriptor.url,
        lastStatusCode: args.statusCode ?? undefined,
        lastCheckedAt: now,
        lastChangedAt: args.markChanged ? now : null,
        lastError: args.error,
        etag: args.etag ?? existing?.etag ?? undefined,
        lastModified: args.lastModified ?? existing?.lastModified ?? undefined,
        contentHash: args.contentHash ?? undefined,
        contentLength: args.contentLength ?? undefined,
      },
    });
  }

  private async importPoolFacilities(
    facilities: ReturnType<typeof parsePoolFacilitiesXml>,
  ): Promise<number> {
    for (const facility of facilities) {
      const savedFacility = await this.prisma.poolFacility.upsert({
        where: { externalId: facility.externalId },
        update: {
          name: facility.name,
          address: facility.address,
          type: facility.type,
          sourceUrl: facility.sourceUrl,
          coordinateX: facility.coordinate?.x,
          coordinateY: facility.coordinate?.y,
          userCount: facility.userCount,
          ownerExternalId: facility.ownerExternalId,
          ownerName: facility.ownerName,
          ownerPhone: facility.ownerPhone,
          ownerEmail: facility.ownerEmail,
          lastInspectionAt: facility.lastInspectionAt,
          inspector: facility.inspector,
        },
        create: {
          externalId: facility.externalId,
          name: facility.name,
          address: facility.address,
          type: facility.type,
          sourceUrl: facility.sourceUrl,
          coordinateX: facility.coordinate?.x,
          coordinateY: facility.coordinate?.y,
          userCount: facility.userCount,
          ownerExternalId: facility.ownerExternalId,
          ownerName: facility.ownerName,
          ownerPhone: facility.ownerPhone,
          ownerEmail: facility.ownerEmail,
          lastInspectionAt: facility.lastInspectionAt,
          inspector: facility.inspector,
        },
      });

      for (const pool of facility.pools) {
        const place = await this.upsertPlace({
          type: 'POOL',
          externalId: pool.externalId,
          nameEt: pool.name,
          addressEt: facility.address,
          municipality: this.resolveMunicipality(facility.address),
          coordinate: facility.coordinate,
          sourceUrl: pool.sourceUrl ?? facility.sourceUrl,
        });

        await this.prisma.poolProfile.upsert({
          where: { externalId: pool.externalId },
          update: {
            placeId: place.id,
            facilityId: savedFacility.id,
            sourceUrl: pool.sourceUrl,
          },
          create: {
            externalId: pool.externalId,
            placeId: place.id,
            facilityId: savedFacility.id,
            sourceUrl: pool.sourceUrl,
          },
        });
      }
    }

    return facilities.length;
  }

  private async importPoolLocations(
    pools: ParsedPoolLocation[],
  ): Promise<number> {
    for (const pool of pools) {
      const facility = pool.facilityExternalId
        ? await this.prisma.poolFacility.findUnique({
            where: { externalId: pool.facilityExternalId },
            select: { id: true, address: true, coordinateX: true, coordinateY: true },
          })
        : null;

      const primaryPoint = this.pickPrimarySamplingPoint(pool.samplingPoints);
      const coordinate: ParsedCoordinate | undefined = primaryPoint?.coordinate
        ? primaryPoint.coordinate
        : (facility?.coordinateX !== null &&
             facility?.coordinateX !== undefined &&
             facility?.coordinateY !== null &&
             facility?.coordinateY !== undefined)
          ? {
              x: facility.coordinateX,
              y: facility.coordinateY,
            }
          : undefined;
      const address = primaryPoint?.address ?? facility?.address ?? undefined;

      const place = await this.upsertPlace({
        type: 'POOL',
        externalId: pool.externalId,
        nameEt: pool.name,
        addressEt: address,
        municipality: this.resolveMunicipality(address),
        coordinate,
      });

      await this.prisma.poolProfile.upsert({
        where: { externalId: pool.externalId },
        update: {
          placeId: place.id,
          facilityId: facility?.id,
          poolType: pool.poolType,
          loadText: pool.loadText,
          waterExchangeType: pool.waterExchangeType,
          areaM2: pool.areaM2,
          volumeM3: pool.volumeM3,
          perimeterM: pool.perimeterM,
          minDepthCm: pool.minDepthCm,
          maxDepthCm: pool.maxDepthCm,
          assessmentRaw: pool.assessmentRaw,
          assessmentStatus: pool.assessmentStatus,
          assessmentDate: pool.assessmentDate,
          lastInspectionAt: pool.lastInspectionAt,
          inspector: pool.inspector,
          inspectorNotes: pool.inspectorNotes,
        },
        create: {
          externalId: pool.externalId,
          placeId: place.id,
          facilityId: facility?.id,
          poolType: pool.poolType,
          loadText: pool.loadText,
          waterExchangeType: pool.waterExchangeType,
          areaM2: pool.areaM2,
          volumeM3: pool.volumeM3,
          perimeterM: pool.perimeterM,
          minDepthCm: pool.minDepthCm,
          maxDepthCm: pool.maxDepthCm,
          assessmentRaw: pool.assessmentRaw,
          assessmentStatus: pool.assessmentStatus,
          assessmentDate: pool.assessmentDate,
          lastInspectionAt: pool.lastInspectionAt,
          inspector: pool.inspector,
          inspectorNotes: pool.inspectorNotes,
        },
      });

      for (const point of pool.samplingPoints) {
        await this.upsertSamplingPoint(place.id, point);
      }
    }

    return pools.length;
  }

  private async importBeachLocations(
    beaches: ReturnType<typeof parseBeachLocationsXml>,
  ): Promise<number> {
    for (const beach of beaches) {
      const place = await this.upsertPlace({
        type: 'BEACH',
        externalId: beach.externalId,
        nameEt: beach.name,
        addressEt: beach.address,
        municipality: this.resolveMunicipality(beach.address),
        coordinate: beach.coordinate,
        sourceUrl: beach.sourceUrl,
      });

      await this.prisma.beachProfile.upsert({
        where: { externalId: beach.externalId },
        update: {
          placeId: place.id,
          groupId: beach.groupId,
          beachType: beach.beachType,
          sourceUrl: beach.sourceUrl,
          profileUrl: beach.profileUrl,
          waterBodyName: beach.waterBodyName,
          waterBodyType: beach.waterBodyType,
          visitorCount: beach.visitorCount,
          shorelineLengthM: beach.shorelineLengthM,
          monitoringCalendarDate: beach.monitoringCalendarDate,
          lastInspectionAt: beach.lastInspectionAt,
          inspector: beach.inspector,
          latestSampleAt: beach.latestSampleAt,
          latestQualityRaw: beach.latestQualityRaw,
          latestQualityClassRaw: beach.latestQualityClassRaw,
          samplingProtocolNumber: beach.samplingProtocolNumber,
          coverLetterNumber: beach.coverLetterNumber,
          samplerRole: beach.samplerRole,
          inspectorComments: beach.inspectorComments,
        },
        create: {
          externalId: beach.externalId,
          placeId: place.id,
          groupId: beach.groupId,
          beachType: beach.beachType,
          sourceUrl: beach.sourceUrl,
          profileUrl: beach.profileUrl,
          waterBodyName: beach.waterBodyName,
          waterBodyType: beach.waterBodyType,
          visitorCount: beach.visitorCount,
          shorelineLengthM: beach.shorelineLengthM,
          monitoringCalendarDate: beach.monitoringCalendarDate,
          lastInspectionAt: beach.lastInspectionAt,
          inspector: beach.inspector,
          latestSampleAt: beach.latestSampleAt,
          latestQualityRaw: beach.latestQualityRaw,
          latestQualityClassRaw: beach.latestQualityClassRaw,
          samplingProtocolNumber: beach.samplingProtocolNumber,
          coverLetterNumber: beach.coverLetterNumber,
          samplerRole: beach.samplerRole,
          inspectorComments: beach.inspectorComments,
        },
      });

      for (const point of beach.samplingPoints) {
        await this.upsertSamplingPoint(place.id, point);
      }
    }

    return beaches.length;
  }

  private async importSamples(
    rows: ParsedWaterQualitySample[],
  ): Promise<SampleImportSummary> {
    let inserted = 0;
    const affectedPlaceIds = new Set<string>();

    for (const row of rows) {
      const place = await this.upsertPlace({
        type: row.placeType,
        externalId: row.placeExternalId,
        nameEt: row.placeName,
      });
      affectedPlaceIds.add(place.id);

      let samplingPointId: string | undefined;
      const samplingPointExternalId =
        row.samplingPointExternalId ??
        this.fallbackSamplingPointExternalId(row.samplingPointName);

      if (samplingPointExternalId && row.samplingPointName) {
        const point = await this.upsertSamplingPoint(place.id, {
          externalId: samplingPointExternalId,
          name: row.samplingPointName,
        });
        samplingPointId = point.id;
      }

      const existing = await this.prisma.waterQualitySample.findUnique({
        where: {
          placeId_externalId: {
            placeId: place.id,
            externalId: row.externalId,
          },
        },
        select: { id: true },
      });

      const sample = await this.prisma.waterQualitySample.upsert({
        where: {
          placeId_externalId: {
            placeId: place.id,
            externalId: row.externalId,
          },
        },
        update: {
          sourceYear: row.sourceYear,
          sourceUrl: row.sourceUrl,
          samplingPointId,
          sampledAt: row.sampledAt,
          waterType: row.waterType,
          sampleType: row.sampleType,
          samplerName: row.samplerName,
          samplerRole: row.samplerRole,
          samplerCertificateNumber: row.samplerCertificateNumber,
          samplingPurpose: row.samplingPurpose,
          samplingMethod: row.samplingMethod,
          samplingProtocolNumber: row.samplingProtocolNumber,
          overallAssessmentRaw: row.overallAssessmentRaw,
          overallStatus: row.overallStatus,
        },
        create: {
          source: 'TERVISEAMET_XML',
          sourceYear: row.sourceYear,
          sourceUrl: row.sourceUrl,
          externalId: row.externalId,
          placeId: place.id,
          samplingPointId,
          sampledAt: row.sampledAt,
          waterType: row.waterType,
          sampleType: row.sampleType,
          samplerName: row.samplerName,
          samplerRole: row.samplerRole,
          samplerCertificateNumber: row.samplerCertificateNumber,
          samplingPurpose: row.samplingPurpose,
          samplingMethod: row.samplingMethod,
          samplingProtocolNumber: row.samplingProtocolNumber,
          overallAssessmentRaw: row.overallAssessmentRaw,
          overallStatus: row.overallStatus,
        },
      });

      if (!existing) {
        inserted += 1;
      }

      await this.prisma.waterQualityProtocol.deleteMany({
        where: { sampleId: sample.id },
      });

      for (const protocol of row.protocols) {
        const createdProtocol = await this.prisma.waterQualityProtocol.create({
          data: {
            sampleId: sample.id,
            protocolOrder: protocol.order,
            coverLetterNumber: protocol.coverLetterNumber,
            protocolNumber: protocol.protocolNumber,
            assessmentRaw: protocol.assessmentRaw,
            assessmentStatus: protocol.assessmentStatus,
          },
        });

        if (protocol.indicators.length > 0) {
          await this.prisma.waterQualityIndicator.createMany({
            data: protocol.indicators.map((indicator) => ({
              protocolId: createdProtocol.id,
              indicatorOrder: indicator.order,
              indicatorExternalId: indicator.externalId,
              name: indicator.name,
              valueRaw: indicator.valueRaw,
              valueNumber: indicator.valueNumber,
              unit: indicator.unit,
              assessmentRaw: indicator.assessmentRaw,
              assessmentStatus: indicator.assessmentStatus,
            })),
          });
        }
      }
    }

    return {
      processed: rows.length,
      inserted,
      affectedPlaceIds,
    };
  }

  private async refreshLatestStatuses(placeIds: Set<string>): Promise<number> {
    let statusChanges = 0;

    for (const placeId of placeIds) {
      const latestSample = await this.prisma.waterQualitySample.findFirst({
        where: { placeId },
        orderBy: { sampledAt: 'desc' },
        select: {
          id: true,
          sampledAt: true,
          overallStatus: true,
          overallAssessmentRaw: true,
          sourceUrl: true,
        },
      });

      if (!latestSample) {
        continue;
      }

      const place = await this.prisma.place.findUnique({
        where: { id: placeId },
        select: { id: true, nameEt: true },
      });
      if (!place) {
        continue;
      }

      const previousLatest = await this.prisma.placeLatestStatus.findUnique({
        where: { placeId },
      });
      const now = new Date();

      const statusChange = detectStatusChange(
        previousLatest
          ? {
              id: previousLatest.sampleId,
              placeId: previousLatest.placeId,
              sampledAt: previousLatest.sampledAt.toISOString(),
              status: previousLatest.status,
              statusReasonEt: previousLatest.statusReasonEt ?? '',
              statusReasonEn: previousLatest.statusReasonEn ?? '',
              source: 'TERVISEAMET_XML',
              sourceUrl: previousLatest.sourceUrl,
            }
          : null,
        {
          id: latestSample.id,
          placeId,
          sampledAt: latestSample.sampledAt.toISOString(),
          status: latestSample.overallStatus,
          statusReasonEt: latestSample.overallAssessmentRaw ?? '',
          statusReasonEn: latestSample.overallAssessmentRaw ?? '',
          source: 'TERVISEAMET_XML',
          sourceUrl: latestSample.sourceUrl,
        },
      );

      await this.prisma.placeLatestStatus.upsert({
        where: { placeId },
        update: {
          sampleId: latestSample.id,
          sampledAt: latestSample.sampledAt,
          status: latestSample.overallStatus,
          statusRaw: latestSample.overallAssessmentRaw,
          statusReasonEt: latestSample.overallAssessmentRaw,
          statusReasonEn: latestSample.overallAssessmentRaw,
          sourceUrl: latestSample.sourceUrl,
          changedAt: statusChange ? now : undefined,
        },
        create: {
          placeId,
          sampleId: latestSample.id,
          sampledAt: latestSample.sampledAt,
          status: latestSample.overallStatus,
          statusRaw: latestSample.overallAssessmentRaw,
          statusReasonEt: latestSample.overallAssessmentRaw,
          statusReasonEn: latestSample.overallAssessmentRaw,
          sourceUrl: latestSample.sourceUrl,
          changedAt: statusChange ? now : undefined,
        },
      });

      if (statusChange) {
        statusChanges += 1;
        await this.notifyStatusChange(
          place.id,
          place.nameEt,
          statusChange.previousStatus,
          statusChange.currentStatus,
        );
      }
    }

    return statusChanges;
  }

  private async notifyStatusChange(
    placeId: string,
    placeName: string,
    previousStatus: QualityStatus,
    currentStatus: QualityStatus,
  ): Promise<void> {
    const subscriptions = await this.prisma.notificationPreference.findMany({
      where: {
        placeId,
        qualityChangeAlert: true,
        enabled: true,
      },
      select: {
        userId: true,
      },
    });

    for (const subscription of subscriptions) {
      await this.notificationsService.queueStatusChangeAlert({
        userId: subscription.userId,
        placeId,
        placeName,
        previousStatus,
        currentStatus,
      });
    }
  }

  private pickPrimarySamplingPoint(
    points: ParsedSamplingPoint[],
  ): ParsedSamplingPoint | undefined {
    return points.find((point) => point.coordinate || point.address) ?? points[0];
  }

  private resolveMunicipality(address: string | undefined): string {
    if (!address) {
      return UNKNOWN_MUNICIPALITY;
    }

    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    for (let index = parts.length - 1; index >= 0; index -= 1) {
      const candidate = parts[index];
      if (!candidate) {
        continue;
      }

      const part = candidate.toLowerCase();
      if (
        part.includes(' vald') ||
        part.endsWith('vald') ||
        part.includes(' linn') ||
        part.endsWith('linn') ||
        part.includes('linnaosa')
      ) {
        return candidate;
      }
    }

    return parts[parts.length - 1] ?? UNKNOWN_MUNICIPALITY;
  }

  private externalKey(type: PlaceType, externalId: string): string {
    return `${type}:${externalId}`;
  }

  private fallbackSamplingPointExternalId(
    samplingPointName: string | undefined,
  ): string | undefined {
    if (!samplingPointName) {
      return undefined;
    }

    const normalizedName = samplingPointName.trim().toLowerCase();
    if (!normalizedName) {
      return undefined;
    }

    const hash = createHash('sha1').update(normalizedName).digest('hex').slice(0, 20);
    return `name:${hash}`;
  }

  private async upsertPlace(input: UpsertPlaceInput): Promise<Place> {
    const key = this.externalKey(input.type, input.externalId);
    const cached = this.placeCache.get(key);
    if (cached) {
      return cached;
    }

    const municipality =
      input.municipality ??
      this.resolveMunicipality(input.addressEt) ??
      UNKNOWN_MUNICIPALITY;

    const place = await this.prisma.place.upsert({
      where: { externalKey: key },
      update: {
        externalId: input.externalId,
        nameEt: input.nameEt,
        nameEn: input.nameEt,
        municipality,
        addressEt: input.addressEt,
        addressEn: input.addressEt,
        coordinateX: input.coordinate?.x,
        coordinateY: input.coordinate?.y,
        sourceUrl: input.sourceUrl,
      },
      create: {
        externalId: input.externalId,
        externalKey: key,
        type: input.type,
        nameEt: input.nameEt,
        nameEn: input.nameEt,
        municipality,
        addressEt: input.addressEt,
        addressEn: input.addressEt,
        coordinateX: input.coordinate?.x,
        coordinateY: input.coordinate?.y,
        sourceUrl: input.sourceUrl,
      },
    });

    this.placeCache.set(key, place);
    return place;
  }

  private async upsertSamplingPoint(
    placeId: string,
    point: ParsedSamplingPoint,
  ) {
    return this.prisma.samplingPoint.upsert({
      where: {
        placeId_externalId: {
          placeId,
          externalId: point.externalId,
        },
      },
      update: {
        name: point.name,
        address: point.address,
        coordinateX: point.coordinate?.x,
        coordinateY: point.coordinate?.y,
        locationDetails: point.locationDetails,
        waterSourceType: point.waterSourceType,
        pointType: point.pointType,
        pointClass: point.pointClass,
      },
      create: {
        placeId,
        externalId: point.externalId,
        name: point.name,
        address: point.address,
        coordinateX: point.coordinate?.x,
        coordinateY: point.coordinate?.y,
        locationDetails: point.locationDetails,
        waterSourceType: point.waterSourceType,
        pointType: point.pointType,
        pointClass: point.pointClass,
      },
    });
  }
}
