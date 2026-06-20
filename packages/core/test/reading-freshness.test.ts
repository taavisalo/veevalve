import { describe, expect, it } from 'vitest';

import { isWaterQualityReadingStale } from '../src/quality/reading-freshness';

describe('isWaterQualityReadingStale', () => {
  const referenceTimeIso = '2026-06-20T12:00:00.000Z';

  it('marks readings older than three calendar months as stale', () => {
    expect(isWaterQualityReadingStale('2026-03-20T11:59:59.999Z', referenceTimeIso)).toBe(true);
  });

  it('keeps readings exactly three calendar months old as current', () => {
    expect(isWaterQualityReadingStale('2026-03-20T12:00:00.000Z', referenceTimeIso)).toBe(false);
  });

  it('clamps month-end thresholds to the target month length', () => {
    expect(isWaterQualityReadingStale('2026-02-28T12:00:00.000Z', '2026-05-31T12:00:00.000Z')).toBe(
      false,
    );
    expect(isWaterQualityReadingStale('2026-02-28T11:59:59.999Z', '2026-05-31T12:00:00.000Z')).toBe(
      true,
    );
  });

  it('does not mark invalid sample dates as stale', () => {
    expect(isWaterQualityReadingStale('not-a-date', referenceTimeIso)).toBe(false);
  });
});
