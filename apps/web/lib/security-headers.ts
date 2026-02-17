type SecurityHeader = {
  key: string;
  value: string;
};

type WebCspOptions = {
  isProduction: boolean;
  nonce: string;
};

const buildWebContentSecurityPolicy = ({ isProduction, nonce }: WebCspOptions): string => {
  const normalizedNonce = nonce.trim() || 'missing-nonce';
  const scriptSources = ["'self'", `'nonce-${normalizedNonce}'`, "'strict-dynamic'"];
  const styleSources = isProduction
    ? ["'self'", `'nonce-${normalizedNonce}'`]
    : ["'self'", "'unsafe-inline'"];
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
    "default-src 'none'",
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
    `style-src ${styleSources.join(' ')}`,
    "worker-src 'self' blob:",
  ];

  if (isProduction) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
};

export const getWebSecurityHeaders = (isProduction: boolean): SecurityHeader[] => {
  const headers: SecurityHeader[] = [
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
