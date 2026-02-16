import { Controller, HttpCode, Post } from '@nestjs/common';

import { WaterQualityService } from './water-quality.service';

@Controller('water-quality')
export class WaterQualityController {
  constructor(private readonly waterQualityService: WaterQualityService) {}

  @Post('sync')
  @HttpCode(202)
  sync() {
    return this.waterQualityService.syncFromTerviseamet();
  }
}
