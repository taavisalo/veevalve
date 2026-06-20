import type { GeoPoint } from './distance';

export interface Lest97Coordinate {
  x: number;
  y: number;
}

const GRS80_SEMI_MAJOR_AXIS = 6_378_137;
const GRS80_INVERSE_FLATTENING = 298.257222101;
const LEST97_FALSE_EASTING = 500_000;
const LEST97_FALSE_NORTHING = 6_375_000;

const toRadians = (value: number): number => (value * Math.PI) / 180;
const toDegrees = (value: number): number => (value * 180) / Math.PI;

const flattening = 1 / GRS80_INVERSE_FLATTENING;
const eccentricity = Math.sqrt(2 * flattening - flattening ** 2);
const eccentricitySquared = eccentricity ** 2;

const originLatitude = toRadians(57 + 31 / 60 + 3.19415 / 3600);
const originLongitude = toRadians(24);
const firstStandardParallel = toRadians(59 + 20 / 60);
const secondStandardParallel = toRadians(58);

const meridianRadiusFactor = (latitude: number): number =>
  Math.cos(latitude) / Math.sqrt(1 - eccentricitySquared * Math.sin(latitude) ** 2);

const isometricLatitudeFactor = (latitude: number): number =>
  Math.tan(Math.PI / 4 - latitude / 2) /
  ((1 - eccentricity * Math.sin(latitude)) /
    (1 + eccentricity * Math.sin(latitude))) **
    (eccentricity / 2);

const firstMeridianFactor = meridianRadiusFactor(firstStandardParallel);
const secondMeridianFactor = meridianRadiusFactor(secondStandardParallel);
const firstIsometricFactor = isometricLatitudeFactor(firstStandardParallel);
const secondIsometricFactor = isometricLatitudeFactor(secondStandardParallel);
const originIsometricFactor = isometricLatitudeFactor(originLatitude);

const coneConstant =
  (Math.log(firstMeridianFactor) - Math.log(secondMeridianFactor)) /
  (Math.log(firstIsometricFactor) - Math.log(secondIsometricFactor));

const projectionConstant =
  firstMeridianFactor / (coneConstant * firstIsometricFactor ** coneConstant);

const originRadius =
  GRS80_SEMI_MAJOR_AXIS * projectionConstant * originIsometricFactor ** coneConstant;

const coordinateIsValid = (coordinate: Lest97Coordinate): boolean =>
  Number.isFinite(coordinate.x) && Number.isFinite(coordinate.y);

const latitudeFromIsometricFactor = (factor: number): number => {
  let latitude = Math.PI / 2 - 2 * Math.atan(factor);

  for (let index = 0; index < 12; index += 1) {
    latitude =
      Math.PI / 2 -
      2 *
        Math.atan(
          factor *
            ((1 - eccentricity * Math.sin(latitude)) /
              (1 + eccentricity * Math.sin(latitude))) **
              (eccentricity / 2),
        );
  }

  return latitude;
};

export const lest97ToWgs84 = (coordinate: Lest97Coordinate): GeoPoint | undefined => {
  if (!coordinateIsValid(coordinate)) {
    return undefined;
  }

  // Terviseamet XML uses L-EST97 x for northing and y for easting.
  const northing = coordinate.x;
  const easting = coordinate.y;
  const adjustedEasting = easting - LEST97_FALSE_EASTING;
  const adjustedNorthing = originRadius - (northing - LEST97_FALSE_NORTHING);
  const radius =
    Math.sign(coneConstant) *
    Math.sqrt(adjustedEasting ** 2 + adjustedNorthing ** 2);
  const theta = Math.atan2(adjustedEasting, adjustedNorthing);
  const isometricFactor =
    (radius / (GRS80_SEMI_MAJOR_AXIS * projectionConstant)) ** (1 / coneConstant);

  const latitude = latitudeFromIsometricFactor(isometricFactor);
  const longitude = originLongitude + theta / coneConstant;

  return {
    latitude: toDegrees(latitude),
    longitude: toDegrees(longitude),
  };
};
