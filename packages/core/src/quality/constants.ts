import type { QualityStatus } from '../types';

export const QUALITY_LABEL_TO_STATUS: Record<string, QualityStatus> = {
  hea: 'GOOD',
  good: 'GOOD',
  korras: 'GOOD',
  mittevastav: 'BAD',
  halb: 'BAD',
  bad: 'BAD',
  unknown: 'UNKNOWN',
  teadmata: 'UNKNOWN',
};

export const QUALITY_STATUS_PRIORITY: Record<QualityStatus, number> = {
  BAD: 3,
  UNKNOWN: 2,
  GOOD: 1,
};
