import type { FastifyReply } from 'fastify';

type SecurityHeader = {
  key: string;
  value: string;
};

const buildApiContentSecurityPolicy = (isProduction: boolean): string => {
  const directives = [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ];

  if (isProduction) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
};

export const getApiSecurityHeaders = (isProduction: boolean): SecurityHeader[] => {
  const headers: SecurityHeader[] = [
    {
      key: 'Content-Security-Policy',
      value: buildApiContentSecurityPolicy(isProduction),
    },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    {
      key: 'Permissions-Policy',
      value:
        'accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()',
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    { key: 'Origin-Agent-Cluster', value: '?1' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    { key: 'X-XSS-Protection', value: '0' },
  ];

  if (isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
};

export const applyApiSecurityHeaders = (
  reply: FastifyReply,
  isProduction: boolean,
): void => {
  for (const header of getApiSecurityHeaders(isProduction)) {
    reply.header(header.key, header.value);
  }
};

export { buildApiContentSecurityPolicy };
