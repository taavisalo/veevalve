import type { QualityStatus } from '@prisma/client';
import { QUALITY_STATUS_PRIORITY } from '@veevalve/core';

interface LatestPlaceStatusCandidate {
  id: string;
  placeId: string;
  sampledAt: Date;
  overallStatus: QualityStatus;
}

const compareLatestPlaceStatusCandidates = <T extends LatestPlaceStatusCandidate>(
  left: T,
  right: T,
): number => {
  const sampledAtDifference = left.sampledAt.getTime() - right.sampledAt.getTime();
  if (sampledAtDifference !== 0) {
    return sampledAtDifference;
  }

  const statusPriorityDifference =
    QUALITY_STATUS_PRIORITY[left.overallStatus] - QUALITY_STATUS_PRIORITY[right.overallStatus];
  if (statusPriorityDifference !== 0) {
    return statusPriorityDifference;
  }

  return left.id.localeCompare(right.id);
};

export const pickRepresentativeLatestSamples = <T extends LatestPlaceStatusCandidate>(
  samples: T[],
): T[] => {
  const latestByPlaceId = new Map<string, T>();

  for (const sample of samples) {
    const current = latestByPlaceId.get(sample.placeId);
    if (!current || compareLatestPlaceStatusCandidates(sample, current) > 0) {
      latestByPlaceId.set(sample.placeId, sample);
    }
  }

  return [...latestByPlaceId.values()].sort((left, right) =>
    left.placeId.localeCompare(right.placeId),
  );
};
