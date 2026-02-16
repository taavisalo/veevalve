import { Injectable, NotFoundException } from '@nestjs/common';
import type { Place, PlaceType, QualityStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { ListPlacesQuery } from './dto/list-places.query';

export interface PlaceListResponse {
  id: string;
  externalId: string;
  type: PlaceType;
  name: string;
  municipality: string;
  address: string | null;
  latitude: number;
  longitude: number;
  latestReading?: {
    sampledAt: string;
    status: QualityStatus;
    statusReason: string;
  };
}

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlaces(query: ListPlacesQuery): Promise<PlaceListResponse[]> {
    const locale = query.locale ?? 'et';

    const places = await this.prisma.place.findMany({
      where: {
        type: query.type,
        OR: query.search
          ? [
              { nameEt: { contains: query.search, mode: 'insensitive' } },
              { nameEn: { contains: query.search, mode: 'insensitive' } },
              { municipality: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        readings: {
          orderBy: {
            sampledAt: 'desc',
          },
          take: 1,
        },
      },
      skip: query.offset ?? 0,
      take: query.limit ?? 100,
      orderBy: {
        nameEt: 'asc',
      },
    });

    const mapped = places.map((place) => this.toListResponse(place, locale));

    if (!query.status) {
      return mapped;
    }

    return mapped.filter((place) => place.latestReading?.status === query.status);
  }

  async getPlaceById(id: string): Promise<PlaceListResponse> {
    const place = await this.prisma.place.findUnique({
      where: { id },
      include: {
        readings: {
          orderBy: { sampledAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!place) {
      throw new NotFoundException('Place not found');
    }

    return this.toListResponse(place, 'et');
  }

  private toListResponse(place: Place & { readings: Array<{ sampledAt: Date; status: QualityStatus; statusReasonEt: string; statusReasonEn: string }> }, locale: 'et' | 'en'): PlaceListResponse {
    const latest = place.readings[0];

    return {
      id: place.id,
      externalId: place.externalId,
      type: place.type,
      name: locale === 'en' ? place.nameEn : place.nameEt,
      municipality: place.municipality,
      address: locale === 'en' ? (place.addressEn ?? null) : (place.addressEt ?? null),
      latitude: place.latitude,
      longitude: place.longitude,
      latestReading: latest
        ? {
            sampledAt: latest.sampledAt.toISOString(),
            status: latest.status,
            statusReason: locale === 'en' ? latest.statusReasonEn : latest.statusReasonEt,
          }
        : undefined,
    };
  }
}
