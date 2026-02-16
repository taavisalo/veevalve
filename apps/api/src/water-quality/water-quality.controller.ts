import { timingSafeEqual } from 'node:crypto';

import {
  Controller,
  Headers,
  HttpException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { WaterQualityService } from './water-quality.service';

const DEFAULT_SYNC_RATE_LIMIT_MAX = 20;
const DEFAULT_SYNC_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const readPositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const safeTokenEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

@Controller('water-quality')
export class WaterQualityController {
  private readonly syncRateLimitState = new Map<string, { startedAt: number; count: number }>();
  private readonly syncRateLimitMax = readPositiveInteger(
    process.env.SYNC_RATE_LIMIT_MAX,
    DEFAULT_SYNC_RATE_LIMIT_MAX,
  );
  private readonly syncRateLimitWindowMs = readPositiveInteger(
    process.env.SYNC_RATE_LIMIT_WINDOW_MS,
    DEFAULT_SYNC_RATE_LIMIT_WINDOW_MS,
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
    const expectedSyncToken = process.env.SYNC_API_TOKEN?.trim();
    if (allowUnauthenticatedSync && !expectedSyncToken) {
      return;
    }

    const providedSyncToken =
      typeof syncTokenHeader === 'string'
        ? syncTokenHeader
        : Array.isArray(syncTokenHeader)
          ? syncTokenHeader[0]
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

    if (this.syncRateLimitState.size > 2_000) {
      for (const [key, value] of this.syncRateLimitState) {
        if (now - value.startedAt > this.syncRateLimitWindowMs) {
          this.syncRateLimitState.delete(key);
        }
      }
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
}
