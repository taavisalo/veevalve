const DEFAULT_LOCALHOST_CORS_PORTS = [3000, 8081, 8082, 19006] as const;

const DEFAULT_CORS_ORIGINS = DEFAULT_LOCALHOST_CORS_PORTS.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);

type CorsOriginEnvironment = Readonly<Record<string, string | undefined>>;

const INFERRED_ORIGIN_ENV_KEYS = [
  'API_BASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
] as const;

const hasHttpScheme = (value: string): boolean => /^https?:\/\//i.test(value);

const shouldUseLocalHttpScheme = (value: string): boolean => {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(value);
};

export const normalizeOriginFromUrlLike = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = hasHttpScheme(trimmed)
    ? trimmed
    : `${shouldUseLocalHttpScheme(trimmed) ? 'http' : 'https'}://${trimmed}`;

  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
};

const parseCorsOriginEntries = (value: string | undefined): string[] => {
  return value
    ? value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    : [];
};

const normalizeCorsOriginEntries = (origins: string[]): string[] => {
  return origins
    .map((origin) => normalizeOriginFromUrlLike(origin))
    .filter((origin): origin is string => Boolean(origin));
};

export const resolveCorsOrigins = (env: CorsOriginEnvironment = process.env): Set<string> => {
  const configuredOriginEntries = parseCorsOriginEntries(env.CORS_ORIGIN);
  const configuredOrigins = normalizeCorsOriginEntries(configuredOriginEntries);

  const origins = new Set(
    configuredOriginEntries.length > 0 ? configuredOrigins : DEFAULT_CORS_ORIGINS,
  );

  for (const envKey of INFERRED_ORIGIN_ENV_KEYS) {
    const origin = normalizeOriginFromUrlLike(env[envKey]);
    if (origin) {
      origins.add(origin);
    }
  }

  return origins;
};
