import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { GetPlaceParams } from './dto/get-place.params';
import { GetPlaceQuery } from './dto/get-place.query';
import { GetPlacesByIdsQuery } from './dto/get-places-by-ids.query';
import { ListPlacesQuery } from './dto/list-places.query';
import { PlaceListResponseDto, PlaceMetricsResponseDto } from './dto/place-response.dto';
import { PlacesService } from './places.service';

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300')
  @ApiOperation({
    summary: 'List places',
    description:
      'List places with optional filters, search and pagination. Defaults to latest 10 entries.',
  })
  @ApiOkResponse({
    type: PlaceListResponseDto,
    isArray: true,
    description: 'Place list response.',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  listPlaces(@Query() query: ListPlacesQuery) {
    return this.placesService.listPlaces(query);
  }

  @Get('by-ids')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300')
  @ApiOperation({
    summary: 'Fetch places by id list',
    description:
      'Fetch multiple places by ids. Supports `ids=a&ids=b` and `ids=a,b` formats.',
  })
  @ApiOkResponse({
    type: PlaceListResponseDto,
    isArray: true,
    description: 'Ordered list of places matching provided ids.',
  })
  @ApiBadRequestResponse({ description: 'Invalid ids or query parameters.' })
  getPlacesByIds(@Query() query: GetPlacesByIdsQuery) {
    return this.placesService.getPlacesByIds(
      query.ids,
      query.locale ?? 'et',
      query.includeBadDetails,
    );
  }

  @Get('metrics')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
  @ApiOperation({
    summary: 'Get place metrics',
    description: 'Get aggregate counters for places and latest quality statuses.',
  })
  @ApiOkResponse({
    type: PlaceMetricsResponseDto,
    description: 'Aggregated metrics snapshot.',
  })
  getMetrics() {
    return this.placesService.getPlaceMetrics();
  }

  @Get(':id')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
  @ApiOperation({
    summary: 'Get place by id',
    description: 'Fetch a single place with latest water-quality status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Internal place id (Prisma cuid/cuid2 token).',
    example: 'cm6abcd123efg456hij7890kl',
  })
  @ApiOkResponse({
    type: PlaceListResponseDto,
    description: 'Place details.',
  })
  @ApiBadRequestResponse({ description: 'Invalid path or query parameters.' })
  @ApiNotFoundResponse({ description: 'Place not found.' })
  getPlace(@Param() params: GetPlaceParams, @Query() query: GetPlaceQuery) {
    return this.placesService.getPlaceById(params.id, query.locale ?? 'et');
  }
}
