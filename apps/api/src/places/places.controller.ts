import { Controller, Get, Param, Query } from '@nestjs/common';

import { ListPlacesQuery } from './dto/list-places.query';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  listPlaces(@Query() query: ListPlacesQuery) {
    return this.placesService.listPlaces(query);
  }

  @Get(':id')
  getPlace(@Param('id') id: string) {
    return this.placesService.getPlaceById(id);
  }
}
