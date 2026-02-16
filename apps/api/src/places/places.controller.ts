import { Controller, Get, Param, Query } from '@nestjs/common';

import { GetPlaceQuery } from './dto/get-place.query';
import { ListPlacesQuery } from './dto/list-places.query';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  listPlaces(@Query() query: ListPlacesQuery) {
    return this.placesService.listPlaces(query);
  }

  @Get('metrics')
  getMetrics() {
    return this.placesService.getPlaceMetrics();
  }

  @Get(':id')
  getPlace(@Param('id') id: string, @Query() query: GetPlaceQuery) {
    return this.placesService.getPlaceById(id, query.locale ?? 'et');
  }
}
