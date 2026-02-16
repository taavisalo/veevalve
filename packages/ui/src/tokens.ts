import type { QualityStatus } from '@veevalve/core';

export const statusStyles: Record<QualityStatus, { label: string; colorHex: string }> = {
  GOOD: { label: 'Hea', colorHex: '#1E8A4A' },
  BAD: { label: 'Halb', colorHex: '#C33B31' },
  UNKNOWN: { label: 'Teadmata', colorHex: '#7B8794' },
};
