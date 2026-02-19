import { HttpException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WaterQualityController } from '../src/water-quality/water-quality.controller';
import type { WaterQualityService } from '../src/water-quality/water-quality.service';

const createMockSummary = () => ({
  feedsChecked: 1,
  feedsChanged: 1,
  feedsUnchanged: 0,
  feedsNotFound: 0,
  feedsSkippedByInterval: 0,
  metadataRowsProcessed: 0,
  sampleRowsProcessed: 0,
  sampleRowsInserted: 0,
  statusChanges: 0,
});

describe('WaterQualityController security', () => {
  const requestWithIp = (ip: string) => ({ ip } as never);

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SYNC_API_TOKEN;
    delete process.env.ALLOW_UNAUTHENTICATED_SYNC;
    delete process.env.NODE_ENV;
    delete process.env.SYNC_RATE_LIMIT_MAX;
    delete process.env.SYNC_RATE_LIMIT_WINDOW_MS;
    delete process.env.SYNC_RATE_LIMIT_MAX_TRACKED_IPS;
  });

  it('allows unauthenticated sync only in non-production when explicitly enabled', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_UNAUTHENTICATED_SYNC = 'true';

    const summary = createMockSummary();
    const service: Pick<WaterQualityService, 'syncFromTerviseamet'> = {
      syncFromTerviseamet: vi.fn().mockResolvedValue(summary),
    };

    const controller = new WaterQualityController(service as WaterQualityService);

    await expect(controller.sync(requestWithIp('127.0.0.1'), undefined)).resolves.toEqual(summary);
    expect(service.syncFromTerviseamet).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated sync in production even when bypass flag is enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_UNAUTHENTICATED_SYNC = 'true';

    const service: Pick<WaterQualityService, 'syncFromTerviseamet'> = {
      syncFromTerviseamet: vi.fn(),
    };

    const controller = new WaterQualityController(service as WaterQualityService);

    expect(() => controller.sync(requestWithIp('127.0.0.1'), undefined)).toThrow(
      UnauthorizedException,
    );
    expect(service.syncFromTerviseamet).not.toHaveBeenCalled();
  });

  it('accepts a valid sync token and rejects invalid tokens', async () => {
    process.env.SYNC_API_TOKEN = 'super-secure-sync-token';

    const summary = createMockSummary();
    const service: Pick<WaterQualityService, 'syncFromTerviseamet'> = {
      syncFromTerviseamet: vi.fn().mockResolvedValue(summary),
    };
    const controller = new WaterQualityController(service as WaterQualityService);

    await expect(
      controller.sync(requestWithIp('127.0.0.1'), 'super-secure-sync-token'),
    ).resolves.toEqual(summary);
    expect(service.syncFromTerviseamet).toHaveBeenCalledTimes(1);

    expect(() =>
      controller.sync(requestWithIp('127.0.0.1'), 'wrong-token'),
    ).toThrow(UnauthorizedException);
  });

  it('rejects duplicated sync token header values', () => {
    process.env.SYNC_API_TOKEN = 'super-secure-sync-token';

    const service: Pick<WaterQualityService, 'syncFromTerviseamet'> = {
      syncFromTerviseamet: vi.fn(),
    };
    const controller = new WaterQualityController(service as WaterQualityService);

    expect(() =>
      controller.sync(requestWithIp('127.0.0.1'), ['super-secure-sync-token', 'extra']),
    ).toThrow(UnauthorizedException);
  });

  it('applies sync rate limiting per ip', async () => {
    process.env.SYNC_API_TOKEN = 'super-secure-sync-token';
    process.env.SYNC_RATE_LIMIT_MAX = '1';
    process.env.SYNC_RATE_LIMIT_WINDOW_MS = '60000';

    const summary = createMockSummary();
    const service: Pick<WaterQualityService, 'syncFromTerviseamet'> = {
      syncFromTerviseamet: vi.fn().mockResolvedValue(summary),
    };
    const controller = new WaterQualityController(service as WaterQualityService);

    await expect(
      controller.sync(requestWithIp('127.0.0.1'), 'super-secure-sync-token'),
    ).resolves.toEqual(summary);

    expect(() =>
      controller.sync(requestWithIp('127.0.0.1'), 'super-secure-sync-token'),
    ).toThrow(HttpException);
  });

  it('applies sync rate limiting to invalid token attempts', () => {
    process.env.SYNC_API_TOKEN = 'super-secure-sync-token';
    process.env.SYNC_RATE_LIMIT_MAX = '1';
    process.env.SYNC_RATE_LIMIT_WINDOW_MS = '60000';

    const service: Pick<WaterQualityService, 'syncFromTerviseamet'> = {
      syncFromTerviseamet: vi.fn(),
    };
    const controller = new WaterQualityController(service as WaterQualityService);

    expect(() =>
      controller.sync(requestWithIp('127.0.0.1'), 'wrong-token'),
    ).toThrow(UnauthorizedException);
    expect(() =>
      controller.sync(requestWithIp('127.0.0.1'), 'wrong-token'),
    ).toThrow(HttpException);
    expect(service.syncFromTerviseamet).not.toHaveBeenCalled();
  });
});
