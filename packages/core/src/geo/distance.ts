export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface NearbyResult<T> {
  item: T;
  distanceMeters: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (value: number): number => (value * Math.PI) / 180;

export const isValidGeoPoint = (point: GeoPoint): boolean =>
  Number.isFinite(point.latitude) &&
  Number.isFinite(point.longitude) &&
  Math.abs(point.latitude) <= 90 &&
  Math.abs(point.longitude) <= 180;

export const calculateDistanceMeters = (from: GeoPoint, to: GeoPoint): number => {
  if (!isValidGeoPoint(from) || !isValidGeoPoint(to)) {
    return Number.POSITIVE_INFINITY;
  }

  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
};

export const findNearestByCoordinates = <T extends GeoPoint>(
  origin: GeoPoint,
  candidates: T[],
  options: {
    limit?: number;
    maxDistanceMeters?: number;
  } = {},
): NearbyResult<T>[] => {
  if (!isValidGeoPoint(origin)) {
    return [];
  }

  const limit = options.limit ?? candidates.length;
  const maxDistanceMeters = options.maxDistanceMeters ?? Number.POSITIVE_INFINITY;

  return candidates
    .filter(isValidGeoPoint)
    .map((candidate) => ({
      item: candidate,
      distanceMeters: calculateDistanceMeters(origin, candidate),
    }))
    .filter(({ distanceMeters }) => distanceMeters <= maxDistanceMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, Math.max(0, limit));
};
