import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlacesModule } from './places/places.module';
import { PrismaModule } from './prisma/prisma.module';
import { WaterQualityModule } from './water-quality/water-quality.module';
import { WebPushModule } from './web-push/web-push.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    PlacesModule,
    WaterQualityModule,
    NotificationsModule,
    WebPushModule,
    AuthModule,
  ],
})
export class AppModule {}
