import { Injectable, Logger } from '@nestjs/common';

interface StatusChangePayload {
  userId: string;
  placeId: string;
  placeName: string;
  previousStatus: 'GOOD' | 'BAD' | 'UNKNOWN';
  currentStatus: 'GOOD' | 'BAD' | 'UNKNOWN';
}

interface GeofencePayload {
  userId: string;
  placeId: string;
  placeName: string;
  distanceMeters: number;
  currentStatus: 'GOOD' | 'BAD' | 'UNKNOWN';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async queueStatusChangeAlert(payload: StatusChangePayload): Promise<void> {
    this.logger.log(
      `Queueing status alert for user=${payload.userId}, place=${payload.placeName}, ${payload.previousStatus}->${payload.currentStatus}`,
    );

    // TODO: integrate with Expo push service and optional email fallback.
  }

  async queueGeofenceAlert(payload: GeofencePayload): Promise<void> {
    this.logger.log(
      `Queueing location alert for user=${payload.userId}, place=${payload.placeName}, distance=${payload.distanceMeters}`,
    );

    // TODO: trigger when user enters configured radius near place coordinates.
  }
}
