import { describe, expect, it } from 'vitest';

import type { WaterQualityReading } from '../src/types';
import { detectStatusChange } from '../src/notifications/status-change';

const baseReading: WaterQualityReading = {
  id: 'reading-1',
  placeId: 'place-1',
  sampledAt: '2026-02-16T08:00:00.000Z',
  status: 'GOOD',
  statusReasonEt: 'Hea',
  statusReasonEn: 'Good',
  source: 'TERVISEAMET_XML',
  sourceUrl: 'https://vtiav.sm.ee/index.php/?active_tab_id=A',
};

describe('detectStatusChange', () => {
  it('returns event when status changes', () => {
    const result = detectStatusChange(baseReading, {
      ...baseReading,
      id: 'reading-2',
      status: 'BAD',
    });

    expect(result?.currentStatus).toBe('BAD');
    expect(result?.previousStatus).toBe('GOOD');
  });

  it('returns null when status stays the same', () => {
    const result = detectStatusChange(baseReading, {
      ...baseReading,
      id: 'reading-3',
    });

    expect(result).toBeNull();
  });
});
