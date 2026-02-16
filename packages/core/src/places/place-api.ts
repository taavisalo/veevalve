import type { PlaceType, PlaceWithLatestReading, QualityStatus, WaterQualityReading } from '../types';

export interface PlaceApiRow {
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

const DEFAULT_SOURCE_URL = 'https://vtiav.sm.ee/index.php/?active_tab_id=A';

const toLatestReading = (
  placeId: string,
  row: PlaceApiRow['latestReading'],
): WaterQualityReading | undefined => {
  if (!row) {
    return undefined;
  }

  return {
    id: `${placeId}-latest`,
    placeId,
    sampledAt: row.sampledAt,
    status: row.status,
    statusReasonEt: row.statusReason,
    statusReasonEn: row.statusReason,
    source: 'TERVISEAMET_XML',
    sourceUrl: DEFAULT_SOURCE_URL,
  };
};

const toPlaceWithLatestReading = (row: PlaceApiRow): PlaceWithLatestReading => ({
  id: row.id,
  externalId: row.externalId,
  type: row.type,
  nameEt: row.name,
  nameEn: row.name,
  municipality: row.municipality,
  addressEt: row.address ?? undefined,
  addressEn: row.address ?? undefined,
  latitude: row.latitude ?? 0,
  longitude: row.longitude ?? 0,
  latestReading: toLatestReading(row.id, row.latestReading),
});

export const mapPlaceApiRows = (rows: PlaceApiRow[]): PlaceWithLatestReading[] =>
  rows.map(toPlaceWithLatestReading);
