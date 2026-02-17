import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { QualityStatus } from '@prisma/client';
import webPush from 'web-push';

import { PrismaService } from '../prisma/prisma.service';
import type { NormalizedWebPushSubscription } from './dto/push-subscription.dto';

const DEFAULT_WEB_PUSH_ALLOWED_ENDPOINT_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  'notify.windows.com',
];

const STATUS_LABELS: Record<'et' | 'en', Record<QualityStatus, string>> = {
  et: {
    GOOD: 'Hea',
    BAD: 'Halb',
    UNKNOWN: 'Teadmata',
  },
  en: {
    GOOD: 'Good',
    BAD: 'Bad',
    UNKNOWN: 'Unknown',
  },
};

interface WebPushStatusChangeInput {
  placeId: string;
  previousStatus: QualityStatus;
  currentStatus: QualityStatus;
}

interface UpsertWebPushSubscriptionInput {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
    expirationTime?: number | null;
  };
  favoritePlaceIds: string[];
  locale: 'et' | 'en';
  userAgent: string | null;
}

interface MaybeStatusCodeError {
  statusCode?: number;
  body?: string;
  message?: string;
}

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly allowedEndpointHosts = this.resolveAllowedEndpointHosts();
  private readonly isVapidConfigured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();

    this.isVapidConfigured = Boolean(publicKey && privateKey && subject);

    if (this.isVapidConfigured && publicKey && privateKey && subject) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
      return;
    }

    this.logger.warn(
      'Web push is disabled because WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY, or WEB_PUSH_VAPID_SUBJECT is missing.',
    );
  }

  isEnabled(): boolean {
    return this.isVapidConfigured;
  }

  async upsertSubscription(input: UpsertWebPushSubscriptionInput): Promise<{ favoriteCount: number }> {
    this.assertConfigured();

    const normalized = this.normalizeSubscription(input.subscription);
    this.assertAllowedEndpoint(normalized.endpoint);

    const normalizedFavoritePlaceIds = this.normalizeFavoritePlaceIds(input.favoritePlaceIds);
    const validFavoriteIds = await this.resolveExistingPlaceIds(normalizedFavoritePlaceIds);

    await this.prisma.$transaction(async (tx) => {
      const savedSubscription = await tx.webPushSubscription.upsert({
        where: {
          endpoint: normalized.endpoint,
        },
        update: {
          p256dh: normalized.p256dh,
          auth: normalized.auth,
          expirationTime: normalized.expirationTime,
          locale: input.locale,
          enabled: true,
          userAgent: input.userAgent,
          lastError: null,
          lastSeenAt: new Date(),
        },
        create: {
          endpoint: normalized.endpoint,
          p256dh: normalized.p256dh,
          auth: normalized.auth,
          expirationTime: normalized.expirationTime,
          locale: input.locale,
          enabled: true,
          userAgent: input.userAgent,
          lastSeenAt: new Date(),
        },
      });

      await tx.webPushFavorite.deleteMany({
        where: {
          subscriptionId: savedSubscription.id,
        },
      });

      if (validFavoriteIds.length > 0) {
        await tx.webPushFavorite.createMany({
          data: validFavoriteIds.map((placeId) => ({
            subscriptionId: savedSubscription.id,
            placeId,
          })),
          skipDuplicates: true,
        });
      }
    });

    return {
      favoriteCount: validFavoriteIds.length,
    };
  }

  async deleteSubscription(endpoint: string): Promise<void> {
    const normalizedEndpoint = endpoint.trim();
    if (!normalizedEndpoint) {
      return;
    }

    await this.prisma.webPushSubscription.deleteMany({
      where: {
        endpoint: normalizedEndpoint,
      },
    });
  }

  async sendStatusChangeNotifications(input: WebPushStatusChangeInput): Promise<number> {
    if (!this.isVapidConfigured) {
      return 0;
    }

    const subscriptions = await this.prisma.webPushSubscription.findMany({
      where: {
        enabled: true,
        favorites: {
          some: {
            placeId: input.placeId,
          },
        },
      },
      select: {
        id: true,
        endpoint: true,
        p256dh: true,
        auth: true,
        locale: true,
      },
    });

    if (subscriptions.length === 0) {
      return 0;
    }

    const place = await this.prisma.place.findUnique({
      where: {
        id: input.placeId,
      },
      select: {
        nameEt: true,
        nameEn: true,
      },
    });

    const settled = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        this.assertAllowedEndpoint(subscription.endpoint);

        const locale: 'et' | 'en' = subscription.locale === 'en' ? 'en' : 'et';
        const placeName = locale === 'en' ? (place?.nameEn ?? place?.nameEt ?? 'VeeValve') : (place?.nameEt ?? place?.nameEn ?? 'VeeValve');
        const body =
          locale === 'et'
            ? `Vee kvaliteet muutus: ${STATUS_LABELS.et[input.previousStatus]} -> ${STATUS_LABELS.et[input.currentStatus]}`
            : `Water quality changed: ${STATUS_LABELS.en[input.previousStatus]} -> ${STATUS_LABELS.en[input.currentStatus]}`;

        const payload = JSON.stringify({
          title: `VeeValve: ${placeName}`,
          body,
          url: '/?locale=' + locale,
          placeId: input.placeId,
          previousStatus: input.previousStatus,
          currentStatus: input.currentStatus,
        });

        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              expirationTime: null,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
              },
            },
            payload,
            {
              TTL: 60 * 60,
              urgency: 'high',
              topic: `place-${input.placeId}`,
            },
          );

          await this.prisma.webPushSubscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              lastError: null,
              lastNotifiedAt: new Date(),
            },
          });

          return true;
        } catch (error) {
          const statusCode = this.readStatusCode(error);
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.webPushSubscription.delete({
              where: {
                id: subscription.id,
              },
            });
            return false;
          }

          await this.prisma.webPushSubscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              lastError: this.readErrorMessage(error),
            },
          });

          return false;
        }
      }),
    );

    return settled.filter((entry) => entry.status === 'fulfilled' && entry.value).length;
  }

  private assertConfigured(): void {
    if (this.isVapidConfigured) {
      return;
    }

    throw new ServiceUnavailableException('Web push is not configured.');
  }

  private normalizeSubscription(input: UpsertWebPushSubscriptionInput['subscription']): NormalizedWebPushSubscription {
    const endpoint = input.endpoint.trim();
    const p256dh = input.keys.p256dh.trim();
    const auth = input.keys.auth.trim();
    const expirationTimeRaw = input.expirationTime;

    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException('Subscription endpoint and keys are required.');
    }

    if (endpoint.length > 4096 || p256dh.length > 4096 || auth.length > 4096) {
      throw new BadRequestException('Subscription values exceed allowed length.');
    }

    if (expirationTimeRaw == null) {
      return {
        endpoint,
        p256dh,
        auth,
        expirationTime: null,
      };
    }

    const expirationNumber =
      typeof expirationTimeRaw === 'number' ? expirationTimeRaw : Number.NaN;
    if (!Number.isFinite(expirationNumber) || expirationNumber < 0) {
      throw new BadRequestException('Subscription expirationTime is invalid.');
    }

    return {
      endpoint,
      p256dh,
      auth,
      expirationTime: BigInt(Math.trunc(expirationNumber)),
    };
  }

  private normalizeFavoritePlaceIds(placeIds: string[]): string[] {
    const unique = new Set<string>();
    for (const rawPlaceId of placeIds) {
      const placeId = rawPlaceId.trim();
      if (!placeId) {
        continue;
      }

      unique.add(placeId);
      if (unique.size >= 50) {
        break;
      }
    }

    return [...unique];
  }

  private async resolveExistingPlaceIds(placeIds: string[]): Promise<string[]> {
    if (placeIds.length === 0) {
      return [];
    }

    const existing = await this.prisma.place.findMany({
      where: {
        id: {
          in: placeIds,
        },
      },
      select: {
        id: true,
      },
    });

    const existingSet = new Set(existing.map((row) => row.id));
    return placeIds.filter((id) => existingSet.has(id));
  }

  private resolveAllowedEndpointHosts(): Set<string> {
    const configuredHosts = (process.env.WEB_PUSH_ALLOWED_ENDPOINT_HOSTS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase().replace(/\.$/, ''))
      .filter((value) => value.length > 0);

    return new Set(
      configuredHosts.length > 0
        ? configuredHosts
        : DEFAULT_WEB_PUSH_ALLOWED_ENDPOINT_HOSTS,
    );
  }

  private assertAllowedEndpoint(endpoint: string): void {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new BadRequestException('Subscription endpoint URL is invalid.');
    }

    if (url.protocol !== 'https:') {
      throw new BadRequestException('Subscription endpoint must use HTTPS.');
    }

    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const isAllowed = [...this.allowedEndpointHosts].some((allowedHost) =>
      host === allowedHost || host.endsWith(`.${allowedHost}`),
    );
    if (!isAllowed) {
      throw new BadRequestException('Subscription endpoint host is not allowed.');
    }
  }

  private readStatusCode(error: unknown): number | null {
    const candidate = error as MaybeStatusCodeError;
    if (typeof candidate?.statusCode === 'number') {
      return candidate.statusCode;
    }

    return null;
  }

  private readErrorMessage(error: unknown): string {
    const candidate = error as MaybeStatusCodeError;
    if (typeof candidate?.body === 'string' && candidate.body.trim().length > 0) {
      return candidate.body.slice(0, 1000);
    }
    if (typeof candidate?.message === 'string' && candidate.message.trim().length > 0) {
      return candidate.message.slice(0, 1000);
    }

    return 'Unknown web push error';
  }
}
