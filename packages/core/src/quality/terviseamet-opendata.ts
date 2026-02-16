import { XMLParser } from 'fast-xml-parser';

import type { PlaceType, QualityStatus } from '../types';
import { QUALITY_STATUS_PRIORITY } from './constants';
import { parseQualityStatus } from './parse-status';

type UnknownRecord = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

const decodeXmlEntities = (value: string): string => {
  const decodeCodePoint = (raw: string, radix: 10 | 16): string => {
    const codePoint = Number.parseInt(raw, radix);
    if (!Number.isFinite(codePoint)) {
      return '';
    }

    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return '';
    }
  };

  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => decodeCodePoint(hex, 16))
    .replace(/&#([0-9]+);/g, (_match, dec) => decodeCodePoint(dec, 10))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

const asRecord = (value: unknown): UnknownRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
};

const toArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const toText = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = decodeXmlEntities(value).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
};

const pickText = (record: UnknownRecord, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = toText(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
};

const parseNumber = (value: unknown): number | undefined => {
  const text = toText(value);
  if (!text) {
    return undefined;
  }

  const normalized = text.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseInteger = (value: unknown): number | undefined => {
  const text = toText(value);
  if (!text) {
    return undefined;
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseDatePattern = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/;

export const parseTerviseametDate = (value: unknown): Date | undefined => {
  const text = toText(value);
  if (!text) {
    return undefined;
  }

  const match = text.match(parseDatePattern);
  if (match) {
    const [, dayText, monthText, yearText, hourText = '0', minuteText = '0'] = match;
    if (!dayText || !monthText || !yearText) {
      return undefined;
    }

    const day = Number.parseInt(dayText, 10);
    const month = Number.parseInt(monthText, 10);
    const year = Number.parseInt(yearText, 10);
    const hour = Number.parseInt(hourText, 10);
    const minute = Number.parseInt(minuteText, 10);
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const pickWorstStatus = (statuses: QualityStatus[]): QualityStatus => {
  const [firstStatus, ...remaining] = statuses;
  if (!firstStatus) {
    return 'UNKNOWN';
  }

  let worst: QualityStatus = firstStatus;
  for (const candidate of remaining) {
    if (QUALITY_STATUS_PRIORITY[candidate] > QUALITY_STATUS_PRIORITY[worst]) {
      worst = candidate;
    }
  }

  return worst;
};

const getRows = (document: unknown, rootKey: string, rowKey: string): unknown[] => {
  const rootContainer = asRecord(document);
  const root = asRecord(rootContainer?.[rootKey]);
  return toArray(root?.[rowKey]);
};

export interface ParsedCoordinate {
  x: number;
  y: number;
}

export interface ParsedSamplingPoint {
  externalId: string;
  name: string;
  address?: string;
  coordinate?: ParsedCoordinate;
  locationDetails?: string;
  waterSourceType?: string;
  pointType?: string;
  pointClass?: string;
}

export interface ParsedPoolFacilityReference {
  externalId: string;
  name: string;
  sourceUrl?: string;
}

export interface ParsedPoolFacility {
  externalId: string;
  name: string;
  address?: string;
  type?: string;
  sourceUrl?: string;
  coordinate?: ParsedCoordinate;
  userCount?: number;
  ownerExternalId?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  lastInspectionAt?: Date;
  inspector?: string;
  pools: ParsedPoolFacilityReference[];
}

export interface ParsedPoolLocation {
  externalId: string;
  facilityExternalId?: string;
  name: string;
  poolType?: string;
  loadText?: string;
  waterExchangeType?: string;
  areaM2?: number;
  volumeM3?: number;
  perimeterM?: number;
  minDepthCm?: number;
  maxDepthCm?: number;
  lastInspectionAt?: Date;
  inspector?: string;
  assessmentRaw?: string;
  assessmentStatus: QualityStatus;
  assessmentDate?: Date;
  inspectorNotes?: string;
  samplingPoints: ParsedSamplingPoint[];
}

export interface ParsedBeachLocation {
  externalId: string;
  name: string;
  groupId?: string;
  beachType?: string;
  sourceUrl?: string;
  profileUrl?: string;
  address?: string;
  coordinate?: ParsedCoordinate;
  waterBodyName?: string;
  waterBodyType?: string;
  visitorCount?: number;
  shorelineLengthM?: number;
  monitoringCalendarDate?: Date;
  lastInspectionAt?: Date;
  inspector?: string;
  latestSampleAt?: Date;
  latestQualityRaw?: string;
  latestQualityClassRaw?: string;
  samplingMethods: string[];
  samplingProtocolNumber?: string;
  coverLetterNumber?: string;
  samplerRole?: string;
  inspectorComments?: string;
  samplingPoints: ParsedSamplingPoint[];
}

export interface ParsedWaterQualityIndicator {
  order: number;
  externalId?: string;
  name: string;
  valueRaw?: string;
  valueNumber?: number;
  unit?: string;
  assessmentRaw?: string;
  assessmentStatus: QualityStatus;
}

export interface ParsedWaterQualityProtocol {
  order: number;
  coverLetterNumber?: string;
  protocolNumber?: string;
  assessmentRaw?: string;
  assessmentStatus: QualityStatus;
  indicators: ParsedWaterQualityIndicator[];
}

export interface ParsedWaterQualitySample {
  externalId: string;
  placeExternalId: string;
  placeName: string;
  placeType: PlaceType;
  sampledAt: Date;
  sourceYear: number;
  sourceUrl: string;
  waterType?: string;
  sampleType?: string;
  samplerName?: string;
  samplerRole?: string;
  samplerCertificateNumber?: string;
  samplingPurpose?: string;
  samplingMethod?: string;
  samplingProtocolNumber?: string;
  samplingPointExternalId?: string;
  samplingPointName?: string;
  protocols: ParsedWaterQualityProtocol[];
  overallAssessmentRaw?: string;
  overallStatus: QualityStatus;
}

const parseCoordinate = (value: unknown): ParsedCoordinate | undefined => {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  const candidates = toArray(record.koordinaat);
  for (const candidate of candidates) {
    const coordinate = asRecord(candidate);
    if (!coordinate) {
      continue;
    }

    const x = parseNumber(coordinate.x);
    const y = parseNumber(coordinate.y);
    if (x !== undefined && y !== undefined) {
      return { x, y };
    }
  }

  return undefined;
};

const parseSamplingPoints = (value: unknown): ParsedSamplingPoint[] => {
  const container = asRecord(value);
  if (!container) {
    return [];
  }

  const points = toArray(container.proovivotukoht);
  return points.flatMap((pointValue) => {
    const point = asRecord(pointValue);
    if (!point) {
      return [];
    }

    const externalId = pickText(point, ['id']);
    const name = pickText(point, ['nimi', 'nimetus']);
    if (!externalId || !name) {
      return [];
    }

    return [
      {
        externalId,
        name,
        address: pickText(point, ['aadress']),
        coordinate: parseCoordinate(point.koordinaadid),
        locationDetails: pickText(point, ['asukoha_tapsustus']),
        waterSourceType: pickText(point, ['veeallika_liik']),
        pointType: pickText(point, ['proovivotukoha_liik']),
        pointClass: pickText(point, ['proovivotukoha_liigitus']),
      },
    ];
  });
};

const parseSamplingMethods = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  const methods: string[] = [];
  for (const entry of toArray(value)) {
    const entryRecord = asRecord(entry);
    if (entryRecord) {
      for (const candidate of toArray(entryRecord.proovivotu_metoodika)) {
        const text = toText(candidate);
        if (text) {
          methods.push(text);
        }
      }
    } else {
      const text = toText(entry);
      if (text) {
        methods.push(text);
      }
    }
  }

  return [...new Set(methods)];
};

export const parsePoolFacilitiesXml = (xml: string): ParsedPoolFacility[] => {
  const document = parser.parse(xml);
  const rows = getRows(document, 'ujulad', 'ujula');

  return rows.flatMap((value) => {
    const row = asRecord(value);
    if (!row) {
      return [];
    }

    const externalId = pickText(row, ['id']);
    const name = pickText(row, ['nimetus']);
    if (!externalId || !name) {
      return [];
    }

    const poolsContainer = asRecord(row.basseinid);
    const pools = toArray(poolsContainer?.bassein).flatMap((poolValue) => {
      const pool = asRecord(poolValue);
      if (!pool) {
        return [];
      }

      const poolExternalId = pickText(pool, ['id']);
      const poolName = pickText(pool, ['nimetus']);
      if (!poolExternalId || !poolName) {
        return [];
      }

      return [
        {
          externalId: poolExternalId,
          name: poolName,
          sourceUrl: pickText(pool, ['basseini_avaandmete_URL']),
        },
      ];
    });

    return [
      {
        externalId,
        name,
        address: pickText(row, ['aadress']),
        type: pickText(row, ['tyyp']),
        sourceUrl: pickText(row, ['ujula_avaandmete_URL']),
        coordinate: parseCoordinate(row.koordinaadid),
        userCount: parseInteger(row.kasutajate_arv),
        ownerExternalId: pickText(row, ['valdaja_id']),
        ownerName: pickText(row, ['valdaja_nimi']),
        ownerPhone: pickText(row, ['valdaja_telefon']),
        ownerEmail: pickText(row, ['valdaja_epost']),
        lastInspectionAt: parseTerviseametDate(row.viimane_inspekteerimine),
        inspector: pickText(row, ['inspekteerija']),
        pools,
      },
    ];
  });
};

export const parsePoolLocationsXml = (xml: string): ParsedPoolLocation[] => {
  const document = parser.parse(xml);
  const rows = getRows(document, 'basseinid', 'bassein');

  return rows.flatMap((value) => {
    const row = asRecord(value);
    if (!row) {
      return [];
    }

    const externalId = pickText(row, ['id']);
    const name = pickText(row, ['nimetus']);
    if (!externalId || !name) {
      return [];
    }

    const assessmentRaw = pickText(row, ['hinnang']);
    const samplingPointContainer = asRecord(row.proovivotukohad);

    return [
      {
        externalId,
        facilityExternalId: pickText(row, ['ujula_id']),
        name,
        poolType: pickText(row, ['tyyp']),
        loadText: pickText(row, ['koormus']),
        waterExchangeType: pickText(row, ['veevahetustyyp']),
        areaM2: parseNumber(row.pindala),
        volumeM3: parseNumber(row.ruumala),
        perimeterM: parseNumber(row.ymbermoot),
        minDepthCm: parseNumber(row.min_sygavus),
        maxDepthCm: parseNumber(row.max_sygavus),
        lastInspectionAt: parseTerviseametDate(row.viimane_inspekteerimine),
        inspector: pickText(row, ['inspekteerija']),
        assessmentRaw,
        assessmentStatus: parseQualityStatus(assessmentRaw),
        assessmentDate: parseTerviseametDate(row.hinnangu_kuupaev),
        inspectorNotes: pickText(row, ['inspektori_markused']),
        samplingPoints: parseSamplingPoints(samplingPointContainer),
      },
    ];
  });
};

export const parseBeachLocationsXml = (xml: string): ParsedBeachLocation[] => {
  const document = parser.parse(xml);
  const rows = getRows(document, 'supluskohad', 'supluskoht');

  return rows.flatMap((value) => {
    const row = asRecord(value);
    if (!row) {
      return [];
    }

    const externalId = pickText(row, ['id']);
    const name = pickText(row, ['nimetus']);
    if (!externalId || !name) {
      return [];
    }

    const samplingPointContainer = asRecord(row.proovivotukohad);
    const methodContainer = asRecord(row.proovivotu_metoodikad);

    return [
      {
        externalId,
        name,
        groupId: pickText(row, ['supluskoha_grupi_id']),
        beachType: pickText(row, ['tyyp']),
        sourceUrl: pickText(row, ['supluskoha_avaandmete_URL']),
        profileUrl: pickText(row, ['suplusvee_profiili_URL']),
        address: pickText(row, ['aadress']),
        coordinate: parseCoordinate(row.koordinaadid),
        waterBodyName: pickText(row, ['veekogu_nimi']),
        waterBodyType: pickText(row, ['veekogu_tyyp']),
        visitorCount: parseInteger(row.kylastajate_arv),
        shorelineLengthM: parseNumber(row.rannajoone_pikkus),
        monitoringCalendarDate: parseTerviseametDate(
          row.seirekalendri_kooskolastamise_kuupaev,
        ),
        lastInspectionAt: parseTerviseametDate(row.viimane_inspekteerimine),
        inspector: pickText(row, ['inspekteerija']),
        latestSampleAt: parseTerviseametDate(row.viimane_proovivott),
        latestQualityRaw: pickText(row, ['veekvaliteet']),
        latestQualityClassRaw: pickText(row, ['suplusvee_kvaliteediklass']),
        samplingMethods: parseSamplingMethods(methodContainer ?? row.proovivotu_metoodikad),
        samplingProtocolNumber: pickText(row, ['proovivotuprotokolli_number']),
        coverLetterNumber: pickText(row, ['kaaskirja_number']),
        samplerRole: pickText(row, ['proovivotja_amet']),
        inspectorComments: pickText(row, ['inspektori_kommentaarid']),
        samplingPoints: parseSamplingPoints(samplingPointContainer),
      },
    ];
  });
};

const parseIndicators = (value: unknown): ParsedWaterQualityIndicator[] => {
  const container = asRecord(value);
  if (!container) {
    return [];
  }

  const indicators = toArray(container.naitaja);
  return indicators.flatMap((indicatorValue, index) => {
    const indicator = asRecord(indicatorValue);
    if (!indicator) {
      return [];
    }

    const name = pickText(indicator, ['nimetus']);
    if (!name) {
      return [];
    }

    const assessmentRaw = pickText(indicator, ['hinnang']);
    return [
      {
        order: index,
        externalId: pickText(indicator, ['id']),
        name,
        valueRaw: pickText(indicator, ['sisaldus']),
        valueNumber: parseNumber(indicator.sisaldus),
        unit: pickText(indicator, ['yhik']),
        assessmentRaw,
        assessmentStatus: parseQualityStatus(assessmentRaw),
      },
    ];
  });
};

const parseProtocols = (value: unknown): ParsedWaterQualityProtocol[] => {
  const container = asRecord(value);
  if (!container) {
    return [];
  }

  const protocols = toArray(container.katseprotokoll);
  return protocols.flatMap((protocolValue, index) => {
    const protocol = asRecord(protocolValue);
    if (!protocol) {
      return [];
    }

    const indicators = parseIndicators(asRecord(protocol.naitajad));
    const assessmentRaw = pickText(protocol, ['hinnang']);
    const normalizedFromIndicators = pickWorstStatus(
      indicators.map((indicator) => indicator.assessmentStatus),
    );
    const fromProtocol = parseQualityStatus(assessmentRaw);
    const assessmentStatus =
      fromProtocol === 'UNKNOWN' && indicators.length > 0
        ? normalizedFromIndicators
        : fromProtocol;

    return [
      {
        order: index,
        coverLetterNumber: pickText(protocol, ['kaaskirja_number']),
        protocolNumber: pickText(protocol, ['katseprotokolli_number']),
        assessmentRaw,
        assessmentStatus,
        indicators,
      },
    ];
  });
};

interface SampleParseConfig {
  rootKey: string;
  placeIdField: string;
  placeNameField: string;
  placeType: PlaceType;
  sourceYear: number;
  sourceUrl: string;
}

const parseSampleFeed = (xml: string, config: SampleParseConfig): ParsedWaterQualitySample[] => {
  const document = parser.parse(xml);
  const rows = getRows(document, config.rootKey, 'proovivott');

  return rows.flatMap((value) => {
    const row = asRecord(value);
    if (!row) {
      return [];
    }

    const externalId = pickText(row, ['id']);
    const placeExternalId = pickText(row, [config.placeIdField]);
    const placeName = pickText(row, [config.placeNameField]);
    const sampledAt = parseTerviseametDate(row.proovivotu_aeg);

    if (!externalId || !placeExternalId || !placeName || !sampledAt) {
      return [];
    }

    const protocols = parseProtocols(asRecord(row.katseprotokollid));
    const overallStatuses = protocols.map((protocol) => protocol.assessmentStatus);
    const overallStatus = pickWorstStatus(overallStatuses);
    const firstNonEmptyAssessment = protocols.find((protocol) => protocol.assessmentRaw);

    const point = asRecord(row.proovivotukoht);

    return [
      {
        externalId,
        placeExternalId,
        placeName,
        placeType: config.placeType,
        sampledAt,
        sourceYear: config.sourceYear,
        sourceUrl: config.sourceUrl,
        waterType: pickText(row, ['veeliik']),
        sampleType: pickText(row, ['proovi_liik']),
        samplerName: pickText(row, ['proovivotja_nimi']),
        samplerRole: pickText(row, ['proovivotja_amet']),
        samplerCertificateNumber: pickText(row, ['proovivotja_atesteerimistunnistuse_number']),
        samplingPurpose: pickText(row, ['proovivotu_eesmark']),
        samplingMethod: pickText(row, ['proovivotu_metoodika']),
        samplingProtocolNumber: pickText(row, ['proovivotuprotokolli_number']),
        samplingPointExternalId: pickText(point ?? {}, ['id']),
        samplingPointName: pickText(point ?? {}, ['nimetus', 'nimi']),
        protocols,
        overallAssessmentRaw: firstNonEmptyAssessment?.assessmentRaw,
        overallStatus,
      },
    ];
  });
};

export const parsePoolSamplesXml = (
  xml: string,
  sourceYear: number,
  sourceUrl: string,
): ParsedWaterQualitySample[] =>
  parseSampleFeed(xml, {
    rootKey: 'basseini_veeproovid',
    placeIdField: 'bassein_id',
    placeNameField: 'bassein',
    placeType: 'POOL',
    sourceYear,
    sourceUrl,
  });

export const parseBeachSamplesXml = (
  xml: string,
  sourceYear: number,
  sourceUrl: string,
): ParsedWaterQualitySample[] =>
  parseSampleFeed(xml, {
    rootKey: 'supluskoha_veeproovid',
    placeIdField: 'supluskoht_id',
    placeNameField: 'supluskoht',
    placeType: 'BEACH',
    sourceYear,
    sourceUrl,
  });
