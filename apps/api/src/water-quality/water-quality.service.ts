import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { type PlaceType, type QualityStatus } from '@prisma/client';
import { detectStatusChange, parseTerviseametXml } from '@veevalve/core';

import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_XML_URL = 'https://vtiav.sm.ee/index.php/?active_tab_id=A';

@Injectable()
export class WaterQualityService {
  private readonly logger = new Logger(WaterQualityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 */3 * * *')
  async scheduledSync(): Promise<void> {
    await this.syncFromTerviseamet();
  }

  async syncFromTerviseamet(): Promise<{ imported: number; skipped: number }> {
    const xmlUrl = process.env.TERVISEAMET_XML_URL ?? DEFAULT_XML_URL;
    this.logger.log(`Fetching water quality XML from ${xmlUrl}`);

    const response = await fetch(xmlUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch XML feed (${response.status})`);
    }

    const xml = await response.text();
    const readings = parseTerviseametXml(xml);

    let imported = 0;
    let skipped = 0;

    for (const reading of readings) {
      const place = await this.prisma.place.upsert({
        where: { externalId: reading.placeId },
        update: {
          updatedAt: new Date(),
        },
        create: {
          externalId: reading.placeId,
          nameEt: reading.placeId,
          nameEn: reading.placeId,
          type: this.inferPlaceType(reading.placeId),
          municipality: 'Unknown',
          latitude: 0,
          longitude: 0,
        },
      });

      const sampledAt = new Date(reading.sampledAt);
      if (Number.isNaN(sampledAt.getTime())) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.waterQualityReading.findFirst({
        where: {
          placeId: place.id,
          sampledAt,
          status: reading.status as QualityStatus,
        },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const previous = await this.prisma.waterQualityReading.findFirst({
        where: {
          placeId: place.id,
        },
        orderBy: {
          sampledAt: 'desc',
        },
      });

      const created = await this.prisma.waterQualityReading.create({
        data: {
          placeId: place.id,
          sampledAt,
          status: reading.status as QualityStatus,
          statusReasonEt: reading.statusReasonEt,
          statusReasonEn: reading.statusReasonEn,
          source: 'TERVISEAMET_XML',
          sourceUrl: reading.sourceUrl,
        },
      });

      imported += 1;

      const statusChange = detectStatusChange(
        previous
          ? {
              ...previous,
              sampledAt: previous.sampledAt.toISOString(),
              source: 'TERVISEAMET_XML',
            }
          : null,
        {
          ...created,
          sampledAt: created.sampledAt.toISOString(),
          source: 'TERVISEAMET_XML',
        },
      );

      if (statusChange) {
        const subscriptions = await this.prisma.notificationPreference.findMany({
          where: {
            placeId: place.id,
            qualityChangeAlert: true,
            enabled: true,
          },
          include: {
            user: true,
          },
        });

        for (const subscription of subscriptions) {
          await this.notificationsService.queueStatusChangeAlert({
            userId: subscription.userId,
            placeId: place.id,
            placeName: place.nameEt,
            previousStatus: statusChange.previousStatus,
            currentStatus: statusChange.currentStatus,
          });
        }
      }
    }

    return { imported, skipped };
  }

  private inferPlaceType(placeIdentifier: string): PlaceType {
    const normalized = placeIdentifier.toLowerCase();
    if (normalized.includes('pool') || normalized.includes('bassein')) {
      return 'POOL';
    }

    return 'BEACH';
  }
}
