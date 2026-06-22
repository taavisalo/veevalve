const LIVE_PLACE_S_MAXAGE_SECONDS = 30;
const LIVE_PLACE_STALE_WHILE_REVALIDATE_SECONDS = 120;

export const LIVE_PLACE_CACHE_CONTROL = `public, max-age=0, s-maxage=${LIVE_PLACE_S_MAXAGE_SECONDS}, stale-while-revalidate=${LIVE_PLACE_STALE_WHILE_REVALIDATE_SECONDS}`;
export const PLACE_METRICS_CACHE_CONTROL =
  'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
