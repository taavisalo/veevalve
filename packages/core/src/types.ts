export type PlaceType = 'BEACH' | 'POOL';

export type QualityStatus = 'GOOD' | 'BAD' | 'UNKNOWN';

export type AppLocale = 'et' | 'en';

export type WaterSource = 'TERVISEAMET_XML';

export interface Place {
  id: string;
  externalId: string;
  nameEt: string;
  nameEn: string;
  type: PlaceType;
  addressEt?: string;
  addressEn?: string;
  latitude: number;
  longitude: number;
  municipality: string;
}

export interface WaterQualityReading {
  id: string;
  placeId: string;
  sampledAt: string;
  status: QualityStatus;
  statusReasonEt: string;
  statusReasonEn: string;
  source: WaterSource;
  sourceUrl: string;
}

export interface PlaceWithLatestReading extends Place {
  latestReading?: WaterQualityReading;
}

export interface StatusChangeEvent {
  placeId: string;
  previousStatus: QualityStatus;
  currentStatus: QualityStatus;
  changedAt: string;
}

export interface LocationAlertCandidate {
  placeId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  status: QualityStatus;
}

export interface NearbyLocationAlert extends LocationAlertCandidate {
  distanceMeters: number;
}
