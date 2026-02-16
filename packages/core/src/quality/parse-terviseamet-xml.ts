import { XMLParser } from 'fast-xml-parser';

import type { PlaceType, QualityStatus, WaterQualityReading } from '../types';
import { parseQualityStatus } from './parse-status';

type UnknownRecord = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true,
});

const field = (row: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const extractRows = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) {
    return value.flatMap(extractRows);
  }

  if (value && typeof value === 'object') {
    const record = value as UnknownRecord;
    const keys = Object.keys(record);
    const looksLikeDataRow = keys.some((key) =>
      ['name', 'nimi', 'title', 'status', 'hinnang', 'quality'].includes(key.toLowerCase()),
    );

    if (looksLikeDataRow) {
      return [record];
    }

    return keys.flatMap((key) => extractRows(record[key]));
  }

  return [];
};

const inferType = (rawType: string | undefined): PlaceType => {
  if (!rawType) {
    return 'BEACH';
  }

  const normalized = rawType.toLowerCase();
  if (normalized.includes('bassein') || normalized.includes('pool')) {
    return 'POOL';
  }

  return 'BEACH';
};

const fallbackId = (name: string, sampledAt: string): string => {
  const base = `${name}-${sampledAt}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return base.length > 0 ? base : 'unknown-place';
};

const mapStatusReason = (status: QualityStatus, rawLabel: string | undefined): string => {
  if (rawLabel) {
    return rawLabel;
  }

  switch (status) {
    case 'GOOD':
      return 'Vee kvaliteet on hea.';
    case 'BAD':
      return 'Vee kvaliteet ei vasta nõuetele.';
    default:
      return 'Vee kvaliteet puudub või on uuendamisel.';
  }
};

export const parseTerviseametXml = (xml: string): WaterQualityReading[] => {
  const document = parser.parse(xml);
  const rows = extractRows(document);

  return rows.map((row, index) => {
    const placeName =
      field(row, ['nimi', 'name', 'title', 'location']) ??
      `Unknown location ${String(index + 1)}`;

    const sampledAt =
      field(row, ['sampledAt', 'sample_date', 'proovivott', 'date', 'kuupaev']) ??
      new Date().toISOString();

    const qualityLabel = field(row, ['hinnang', 'quality', 'status']);
    const status = parseQualityStatus(qualityLabel);
    const placeId =
      field(row, ['placeId', 'id', 'uid']) ?? fallbackId(placeName, sampledAt);
    const parsedDate = new Date(sampledAt);
    const sampledAtIso = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();

    return {
      id: `${placeId}-${String(index)}`,
      placeId,
      sampledAt: sampledAtIso,
      status,
      statusReasonEt: mapStatusReason(status, qualityLabel),
      statusReasonEn: qualityLabel ?? 'No quality description was provided.',
      source: 'TERVISEAMET_XML',
      sourceUrl: 'https://vtiav.sm.ee/index.php/?active_tab_id=A',
    };
  });
};

export const classifyPlaceType = inferType;
