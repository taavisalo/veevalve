const SSL_MODE_ALIASES_TO_VERIFY_FULL = new Set(['prefer', 'require', 'verify-ca']);

const isLibpqCompatEnabled = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const normalizeDatabaseSslMode = (rawDatabaseUrl: string): string => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawDatabaseUrl);
  } catch {
    return rawDatabaseUrl;
  }

  const sslMode = parsedUrl.searchParams.get('sslmode');
  if (!sslMode) {
    return rawDatabaseUrl;
  }

  if (isLibpqCompatEnabled(parsedUrl.searchParams.get('uselibpqcompat'))) {
    return rawDatabaseUrl;
  }

  const normalizedSslMode = sslMode.trim().toLowerCase();
  if (!SSL_MODE_ALIASES_TO_VERIFY_FULL.has(normalizedSslMode)) {
    return rawDatabaseUrl;
  }

  parsedUrl.searchParams.set('sslmode', 'verify-full');
  return parsedUrl.toString();
};

export const resolveDatabaseUrl = (): string => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize Prisma.');
  }

  return normalizeDatabaseSslMode(databaseUrl);
};

export { normalizeDatabaseSslMode };
