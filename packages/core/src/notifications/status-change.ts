import type { StatusChangeEvent, WaterQualityReading } from '../types';

export const detectStatusChange = (
  previousReading: WaterQualityReading | null,
  currentReading: WaterQualityReading,
): StatusChangeEvent | null => {
  if (!previousReading) {
    return null;
  }

  if (previousReading.status === currentReading.status) {
    return null;
  }

  return {
    placeId: currentReading.placeId,
    previousStatus: previousReading.status,
    currentStatus: currentReading.status,
    changedAt: currentReading.sampledAt,
  };
};
