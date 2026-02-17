import { Controller, Get, Header, Param, Query } from '@nestjs/common';

import { GetPlaceParams } from './dto/get-place.params';
import { GetPlaceQuery } from './dto/get-place.query';
import { GetPlacesByIdsQuery } from './dto/get-places-by-ids.query';
import { ListPlacesQuery } from './dto/list-places.query';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300')
  listPlaces(@Query() query: ListPlacesQuery) {
    return this.placesService.listPlaces(query);
  }

  @Get('by-ids')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300')
  getPlacesByIds(@Query() query: GetPlacesByIdsQuery) {
    return this.placesService.getPlacesByIds(query.ids, query.locale ?? 'et');
  }

  @Get('metrics')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
  getMetrics() {
    return this.placesService.getPlaceMetrics();
  }

  @Get(':id')
  @Header('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
  getPlace(@Param() params: GetPlaceParams, @Query() query: GetPlaceQuery) {
    return this.placesService.getPlaceById(params.id, query.locale ?? 'et');
  }
}
