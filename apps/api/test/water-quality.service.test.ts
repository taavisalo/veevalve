import { SourceFileKind } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NotificationsService } from '../src/notifications/notifications.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { WaterQualityService } from '../src/water-quality/water-quality.service';
import type { WebPushService } from '../src/web-push/web-push.service';

const createService = () =>
  new WaterQualityService(
    {} as PrismaService,
    {} as NotificationsService,
    {} as WebPushService,
  ) as unknown as {
    feedIntervalMs(fileKind: SourceFileKind): number;
  };

describe('WaterQualityService sync intervals', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks sample feeds every 30 minutes during active polling windows', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'));

    const service = createService();

    expect(service.feedIntervalMs(SourceFileKind.POOL_SAMPLES)).toBe(30 * 60 * 1000);
    expect(service.feedIntervalMs(SourceFileKind.BEACH_SAMPLES)).toBe(30 * 60 * 1000);
  });

  it('keeps metadata and off-season beach sample feeds on a daily interval', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const service = createService();
    const dayMs = 24 * 60 * 60 * 1000;

    expect(service.feedIntervalMs(SourceFileKind.POOL_FACILITIES)).toBe(dayMs);
    expect(service.feedIntervalMs(SourceFileKind.POOL_LOCATIONS)).toBe(dayMs);
    expect(service.feedIntervalMs(SourceFileKind.BEACH_LOCATIONS)).toBe(dayMs);
    expect(service.feedIntervalMs(SourceFileKind.BEACH_SAMPLES)).toBe(dayMs);
  });
});
