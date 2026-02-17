type SecurityHeader = {
  key: string;
  value: string;
};

const buildWebContentSecurityPolicy = (isProduction: boolean): string => {
  const scriptSources = ["'self'", "'unsafe-inline'"];
  const connectSources = ["'self'", 'https:', 'wss:'];

  if (!isProduction) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push(
      'http://localhost:*',
      'http://127.0.0.1:*',
      'http://host.docker.internal:*',
      'ws://localhost:*',
      'ws://127.0.0.1:*',
      'ws://host.docker.internal:*',
    );
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "child-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:",
    "manifest-src 'self'",
    "object-src 'none'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
  ];

  if (isProduction) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
};

export const getWebSecurityHeaders = (isProduction: boolean): SecurityHeader[] => {
  const headers: SecurityHeader[] = [
    {
      key: 'Content-Security-Policy',
      value: buildWebContentSecurityPolicy(isProduction),
    },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
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

export { buildWebContentSecurityPolicy };
