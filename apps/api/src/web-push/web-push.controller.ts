import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import {
  DeleteWebPushSubscriptionDto,
  UpsertWebPushSubscriptionDto,
} from './dto/push-subscription.dto';
import { WebPushUpsertResponseDto } from './dto/web-push-response.dto';
import { WebPushService } from './web-push.service';

const DEFAULT_RATE_LIMIT_MAX = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX_TRACKED_IPS = 10_000;

const readPositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

@ApiTags('web-push')
@Controller('web-push/subscriptions')
export class WebPushController {
  private readonly logger = new Logger(WebPushController.name);
  private readonly rateLimitState = new Map<string, { startedAt: number; count: number }>();
  private readonly rateLimitMax = readPositiveInteger(
    process.env.WEB_PUSH_RATE_LIMIT_MAX,
    DEFAULT_RATE_LIMIT_MAX,
  );
  private readonly rateLimitWindowMs = readPositiveInteger(
    process.env.WEB_PUSH_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS,
  );
  private readonly rateLimitMaxTrackedIps = readPositiveInteger(
    process.env.WEB_PUSH_RATE_LIMIT_MAX_TRACKED_IPS,
    DEFAULT_RATE_LIMIT_MAX_TRACKED_IPS,
  );

  constructor(private readonly webPushService: WebPushService) {}

  @Post()
  @ApiOperation({
    summary: 'Create or update web push subscription',
    description:
      'Registers a browser push subscription and replaces the favorite place ids linked to it.',
  })
  @ApiOkResponse({
    type: WebPushUpsertResponseDto,
    description: 'Subscription saved successfully.',
  })
  @ApiBadRequestResponse({ description: 'Invalid subscription payload.' })
  @ApiTooManyRequestsResponse({ description: 'Web push rate limit exceeded.' })
  @ApiServiceUnavailableResponse({ description: 'Web push is not configured on the server.' })
  async upsertSubscription(
    @Req() request: FastifyRequest,
    @Body() body: UpsertWebPushSubscriptionDto,
  ): Promise<WebPushUpsertResponseDto> {
    this.assertRateLimit(request.ip ?? 'unknown');
    return this.webPushService.upsertSubscription({
      subscription: body.subscription,
      favoritePlaceIds: body.favoritePlaceIds,
      locale: body.locale,
      userAgent: this.readUserAgent(request),
    });
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete web push subscription',
    description: 'Deletes a subscription by endpoint URL if it exists.',
  })
  @ApiNoContentResponse({ description: 'Subscription deleted (or already absent).' })
  @ApiBadRequestResponse({ description: 'Invalid request payload.' })
  @ApiTooManyRequestsResponse({ description: 'Web push rate limit exceeded.' })
  async deleteSubscription(
    @Req() request: FastifyRequest,
    @Body() body: DeleteWebPushSubscriptionDto,
  ): Promise<void> {
    this.assertRateLimit(request.ip ?? 'unknown');
    await this.webPushService.deleteSubscription(body.endpoint);
  }

  private readUserAgent(request: FastifyRequest): string | null {
    const userAgentHeader = request.headers['user-agent'];
    if (typeof userAgentHeader !== 'string') {
      return null;
    }

    const trimmed = userAgentHeader.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.slice(0, 512);
  }

  private assertRateLimit(ip: string): void {
    const now = Date.now();

    this.purgeExpiredRateLimitEntries(now);
    if (this.rateLimitState.size > this.rateLimitMaxTrackedIps) {
      this.purgeExpiredRateLimitEntries(now);
    }
    if (this.rateLimitState.size > this.rateLimitMaxTrackedIps) {
      const trackedIpCount = this.rateLimitState.size;
      this.rateLimitState.clear();
      this.logger.warn(
        `Reset web push rate-limit state after reaching ${String(trackedIpCount)} tracked IPs.`,
      );
    }

    const previous = this.rateLimitState.get(ip);
    if (!previous || now - previous.startedAt > this.rateLimitWindowMs) {
      this.rateLimitState.set(ip, { startedAt: now, count: 1 });
      return;
    }

    if (previous.count >= this.rateLimitMax) {
      throw new HttpException('Web push rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    this.rateLimitState.set(ip, {
      startedAt: previous.startedAt,
      count: previous.count + 1,
    });
  }

  private purgeExpiredRateLimitEntries(now: number): void {
    for (const [key, value] of this.rateLimitState) {
      if (now - value.startedAt > this.rateLimitWindowMs) {
        this.rateLimitState.delete(key);
      }
    }
  }
}
