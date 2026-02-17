import { describe, expect, it } from 'vitest';

import { buildWebContentSecurityPolicy, getWebSecurityHeaders } from '../lib/security-headers';

const toHeaderMap = (headers: { key: string; value: string }[]): Map<string, string> => {
  return new Map(headers.map((header) => [header.key, header.value]));
};

describe('web security headers', () => {
  it('sets hardened defaults in production', () => {
    const headers = toHeaderMap(getWebSecurityHeaders(true));

    expect(headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(headers.get('Content-Security-Policy')).toContain('upgrade-insecure-requests');
    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
  });

  it('keeps development CSP compatible and avoids HSTS', () => {
    const headers = toHeaderMap(getWebSecurityHeaders(false));
    const csp = headers.get('Content-Security-Policy') ?? '';

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain(
      "connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:* http://host.docker.internal:* ws://localhost:* ws://127.0.0.1:* ws://host.docker.internal:*",
    );
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(headers.has('Strict-Transport-Security')).toBe(false);
  });

  it('builds CSP without unsafe-eval in production', () => {
    const csp = buildWebContentSecurityPolicy(true);

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' https: wss:");
    expect(csp).not.toContain('http://localhost:*');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
  });
});
