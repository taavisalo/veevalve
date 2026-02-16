import type { QualityStatus } from '../types';
import { QUALITY_LABEL_TO_STATUS } from './constants';

export const parseQualityStatus = (raw: string | null | undefined): QualityStatus => {
  if (!raw) {
    return 'UNKNOWN';
  }

  const normalized = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedAscii = normalized
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  return (
    QUALITY_LABEL_TO_STATUS[normalized] ??
    QUALITY_LABEL_TO_STATUS[normalizedAscii] ??
    'UNKNOWN'
  );
};
