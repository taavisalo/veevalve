import type { QualityStatus } from '../types';

export const QUALITY_LABEL_TO_STATUS: Record<string, QualityStatus> = {
  hea: 'GOOD',
  'vaga hea': 'GOOD',
  'v\u00e4ga hea': 'GOOD',
  good: 'GOOD',
  korras: 'GOOD',
  vastab: 'GOOD',
  'vastab nouetele': 'GOOD',
  'vastab n\u00f5uetele': 'GOOD',
  'compliant': 'GOOD',
  mittevastav: 'BAD',
  'ei vasta': 'BAD',
  'ei vasta nouetele': 'BAD',
  'ei vasta n\u00f5uetele': 'BAD',
  halb: 'BAD',
  kehv: 'BAD',
  bad: 'BAD',
  unknown: 'UNKNOWN',
  teadmata: 'UNKNOWN',
  puudub: 'UNKNOWN',
};

export const QUALITY_STATUS_PRIORITY: Record<QualityStatus, number> = {
  BAD: 3,
  UNKNOWN: 2,
  GOOD: 1,
};
