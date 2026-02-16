import { createHash, timingSafeEqual } from 'node:crypto';

import {
  Controller,
  Headers,
  HttpException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { WaterQualityService } from './water-quality.service';

const DEFAULT_SYNC_RATE_LIMIT_MAX = 20;
const DEFAULT_SYNC_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_SYNC_RATE_LIMIT_MAX_TRACKED_IPS = 10_000;

const readPositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const safeTokenEquals = (left: string, right: string): boolean => {
  const leftBuffer = createHash('sha256').update(left).digest();
  const rightBuffer = createHash('sha256').update(right).digest();

  return timingSafeEqual(leftBuffer, rightBuffer);
};

@Controller('water-quality')
export class WaterQualityController {
  private readonly logger = new Logger(WaterQualityController.name);
  private readonly syncRateLimitState = new Map<string, { startedAt: number; count: number }>();
  private readonly syncRateLimitMax = readPositiveInteger(
    process.env.SYNC_RATE_LIMIT_MAX,
    DEFAULT_SYNC_RATE_LIMIT_MAX,
  );
  private readonly syncRateLimitWindowMs = readPositiveInteger(
    process.env.SYNC_RATE_LIMIT_WINDOW_MS,
    DEFAULT_SYNC_RATE_LIMIT_WINDOW_MS,
  );
  private readonly syncRateLimitMaxTrackedIps = readPositiveInteger(
    process.env.SYNC_RATE_LIMIT_MAX_TRACKED_IPS,
    DEFAULT_SYNC_RATE_LIMIT_MAX_TRACKED_IPS,
  );

  constructor(private readonly waterQualityService: WaterQualityService) {}

  @Post('sync')
  @HttpCode(202)
  sync(
    @Req() request: FastifyRequest,
    @Headers('x-sync-token') syncTokenHeader: string | string[] | undefined,
  ) {
    this.ensureSyncAuthorized(syncTokenHeader);
    this.assertSyncRateLimit(request.ip ?? 'unknown');
    return this.waterQualityService.syncFromTerviseamet();
  }

  private ensureSyncAuthorized(syncTokenHeader: string | string[] | undefined): void {
    const allowUnauthenticatedSync = process.env.ALLOW_UNAUTHENTICATED_SYNC === 'true';
    const isProduction = process.env.NODE_ENV === 'production';
    const expectedSyncToken = process.env.SYNC_API_TOKEN?.trim();
    if (allowUnauthenticatedSync && isProduction) {
      this.logger.warn(
        'ALLOW_UNAUTHENTICATED_SYNC=true is ignored in production; SYNC_API_TOKEN is required.',
      );
    }

    if (allowUnauthenticatedSync && !isProduction && !expectedSyncToken) {
      return;
    }

    const providedSyncToken =
      typeof syncTokenHeader === 'string'
        ? syncTokenHeader.trim()
        : Array.isArray(syncTokenHeader)
          ? syncTokenHeader[0]?.trim()
          : undefined;
    if (!expectedSyncToken || !providedSyncToken) {
      throw new UnauthorizedException('Missing sync token');
    }

    if (!safeTokenEquals(providedSyncToken, expectedSyncToken)) {
      throw new UnauthorizedException('Invalid sync token');
    }
  }

  private assertSyncRateLimit(ip: string): void {
    const now = Date.now();

    this.purgeExpiredRateLimitEntries(now);

    if (this.syncRateLimitState.size > this.syncRateLimitMaxTrackedIps) {
      this.purgeExpiredRateLimitEntries(now);
    }

    if (this.syncRateLimitState.size > this.syncRateLimitMaxTrackedIps) {
      const trackedIpCount = this.syncRateLimitState.size;
      this.syncRateLimitState.clear();
      this.logger.warn(
        `Reset sync rate-limit state after reaching ${String(trackedIpCount)} tracked IPs.`,
      );
    }

    const previous = this.syncRateLimitState.get(ip);
    if (!previous || now - previous.startedAt > this.syncRateLimitWindowMs) {
      this.syncRateLimitState.set(ip, { startedAt: now, count: 1 });
      return;
    }

    if (previous.count >= this.syncRateLimitMax) {
      throw new HttpException('Sync rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    this.syncRateLimitState.set(ip, {
      startedAt: previous.startedAt,
      count: previous.count + 1,
    });
  }

  private purgeExpiredRateLimitEntries(now: number): void {
    for (const [key, value] of this.syncRateLimitState) {
      if (now - value.startedAt > this.syncRateLimitWindowMs) {
        this.syncRateLimitState.delete(key);
      }
    }
  }
}
