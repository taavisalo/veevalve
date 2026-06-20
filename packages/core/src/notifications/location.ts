import type { LocationAlertCandidate, NearbyLocationAlert } from '../types';
import { calculateDistanceMeters } from '../geo/distance';

export const findNearbyAlerts = (
  userLatitude: number,
  userLongitude: number,
  candidates: LocationAlertCandidate[],
  maxDistanceMeters: number,
): NearbyLocationAlert[] => {
  return candidates
    .map((candidate) => ({
      ...candidate,
      distanceMeters: calculateDistanceMeters(
        { latitude: userLatitude, longitude: userLongitude },
        candidate,
      ),
    }))
    .filter((candidate) => candidate.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
};
