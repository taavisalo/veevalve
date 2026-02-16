import type { LocationAlertCandidate, NearbyLocationAlert } from '../types';

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (value: number): number => (value * Math.PI) / 180;

const haversineMeters = (
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number => {
  const dLat = toRadians(toLat - fromLat);
  const dLon = toRadians(toLon - fromLon);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
};

export const findNearbyAlerts = (
  userLatitude: number,
  userLongitude: number,
  candidates: LocationAlertCandidate[],
  maxDistanceMeters: number,
): NearbyLocationAlert[] => {
  return candidates
    .map((candidate) => ({
      ...candidate,
      distanceMeters: haversineMeters(
        userLatitude,
        userLongitude,
        candidate.latitude,
        candidate.longitude,
      ),
    }))
    .filter((candidate) => candidate.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
};
