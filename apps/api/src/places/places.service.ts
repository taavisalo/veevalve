import { Injectable, NotFoundException } from '@nestjs/common';
import type { Place, PlaceLatestStatus, PlaceType, QualityStatus } from '@prisma/client';

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
        latestStatus: query.status
          ? {
              is: {
                status: query.status,
              },
            }
          : undefined,
      },
      include: {
        latestStatus: true,
      },
      skip: query.offset ?? 0,
      take: query.limit ?? 100,
      orderBy: {
        nameEt: 'asc',
      },
    });

    return places.map((place) => this.toListResponse(place, locale));
  }

  async getPlaceById(id: string): Promise<PlaceListResponse> {
    const place = await this.prisma.place.findUnique({
      where: { id },
      include: {
        latestStatus: true,
      },
    });

    if (!place) {
      throw new NotFoundException('Place not found');
    }

    return this.toListResponse(place, 'et');
  }

  private toListResponse(
    place: Place & { latestStatus: PlaceLatestStatus | null },
    locale: 'et' | 'en',
  ): PlaceListResponse {
    const latest = place.latestStatus;

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
          }
        : undefined,
    };
  }
}
