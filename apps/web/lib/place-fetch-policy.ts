interface PlaceFetchPolicy {
  cacheMode: RequestCache;
  revalidateSeconds?: number;
}

const PLACE_METRICS_REVALIDATE_SECONDS = 60;

export const getPlacesFetchPolicy = (): PlaceFetchPolicy => {
  return {
    cacheMode: 'no-store',
  };
};

export const getFavoritePlacesFetchPolicy = (): PlaceFetchPolicy => {
  return {
    cacheMode: 'no-store',
  };
};

export const getPlaceMetricsFetchPolicy = (): PlaceFetchPolicy => {
  return {
    cacheMode: 'force-cache',
    revalidateSeconds: PLACE_METRICS_REVALIDATE_SECONDS,
  };
};
