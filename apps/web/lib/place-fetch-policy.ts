interface PlaceFetchPolicy {
  cacheMode: RequestCache;
  revalidateSeconds?: number;
}

export const LIVE_PLACE_REVALIDATE_SECONDS = 30;
const PLACE_METRICS_REVALIDATE_SECONDS = 60;

export const getPlacesFetchPolicy = (): PlaceFetchPolicy => {
  return {
    cacheMode: 'force-cache',
    revalidateSeconds: LIVE_PLACE_REVALIDATE_SECONDS,
  };
};

export const getFavoritePlacesFetchPolicy = (): PlaceFetchPolicy => {
  return {
    cacheMode: 'force-cache',
    revalidateSeconds: LIVE_PLACE_REVALIDATE_SECONDS,
  };
};

export const getPlaceMetricsFetchPolicy = (): PlaceFetchPolicy => {
  return {
    cacheMode: 'force-cache',
    revalidateSeconds: PLACE_METRICS_REVALIDATE_SECONDS,
  };
};
