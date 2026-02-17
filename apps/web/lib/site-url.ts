const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1']);

const withDefaultProtocol = (rawValue: string): string => {
  if (/^https?:\/\//i.test(rawValue)) {
    return rawValue;
  }

  const host = rawValue.split('/')[0]?.split(':')[0]?.toLowerCase() ?? '';
  const protocol = LOCALHOST_HOSTS.has(host) ? 'http' : 'https';
  return `${protocol}://${rawValue}`;
};

const normalizeUrl = (rawValue: string): string | null => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = withDefaultProtocol(trimmed);
  try {
    return new URL(withProtocol).toString().replace(/\/$/, '');
  } catch {
    return null;
  }
};

export const resolveSiteUrl = (): string => {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const normalized = normalizeUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return 'http://localhost:3000';
};
