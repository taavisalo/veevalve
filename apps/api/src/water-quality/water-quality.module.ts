import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { PlacesModule } from '../places/places.module';
import { WebPushModule } from '../web-push/web-push.module';
import { WaterQualityController } from './water-quality.controller';
import { WaterQualityService } from './water-quality.service';

@Module({
  imports: [PlacesModule, NotificationsModule, WebPushModule],
  controllers: [WaterQualityController],
  providers: [WaterQualityService],
})
export class WaterQualityModule {}
