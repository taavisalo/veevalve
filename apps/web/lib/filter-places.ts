import type { PlaceWithLatestReading, PlaceType, QualityStatus } from '@veevalve/core/client';

interface FilterInput {
  places: PlaceWithLatestReading[];
  type?: PlaceType | 'ALL';
  status?: QualityStatus | 'ALL';
  search?: string;
}

export const filterPlaces = ({ places, type = 'ALL', status = 'ALL', search }: FilterInput) => {
  const normalizedSearch = search?.trim().toLowerCase();

  return places.filter((place) => {
    const typeMatches = type === 'ALL' ? true : place.type === type;
    const statusMatches =
      status === 'ALL' ? true : (place.latestReading?.status ?? 'UNKNOWN') === status;
    const searchMatches = normalizedSearch
      ? [place.nameEt, place.nameEn, place.municipality, place.addressEt, place.addressEn]
          .filter(Boolean)
          .some((candidate) => candidate?.toLowerCase().includes(normalizedSearch))
      : true;

    return typeMatches && statusMatches && searchMatches;
  });
};
