type NextFetchRequestInit = RequestInit & {
  next?: {
    revalidate: number;
  };
};

export const resolveApiBaseUrl = (): string => {
  const rawBaseUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:3001';
  return rawBaseUrl.replace(/\/+$/, '');
};

export const buildRequestInit = ({
  signal,
  cacheMode,
  revalidateSeconds,
}: {
  signal?: AbortSignal;
  cacheMode?: RequestCache;
  revalidateSeconds?: number;
}): NextFetchRequestInit => {
  const init: NextFetchRequestInit = {};

  if (signal) {
    init.signal = signal;
  }

  if (cacheMode) {
    init.cache = cacheMode;
  }

  if (typeof revalidateSeconds === 'number') {
    init.next = { revalidate: revalidateSeconds };
  }

  return init;
};
