import { describe, expect, it } from 'vitest';

import { buildWebContentSecurityPolicy, getWebSecurityHeaders } from '../lib/security-headers';

const toHeaderMap = (headers: { key: string; value: string }[]): Map<string, string> => {
  return new Map(headers.map((header) => [header.key, header.value]));
};

describe('web security headers', () => {
  it('sets hardened defaults in production response headers', () => {
    const headers = toHeaderMap(getWebSecurityHeaders(true));

    expect(headers.has('Content-Security-Policy')).toBe(false);
    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
  });

  it('omits HSTS in development response headers', () => {
    const headers = toHeaderMap(getWebSecurityHeaders(false));

    expect(headers.has('Content-Security-Policy')).toBe(false);
    expect(headers.has('Strict-Transport-Security')).toBe(false);
  });

  it('builds strict production CSP with nonce', () => {
    const csp = buildWebContentSecurityPolicy({
      isProduction: true,
      nonce: 'nonce-value',
    });

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-nonce-value'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).toContain("connect-src 'self' https: wss:");
    expect(csp).not.toContain('http://localhost:*');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('keeps development CSP compatible with local tooling', () => {
    const csp = buildWebContentSecurityPolicy({
      isProduction: false,
      nonce: 'nonce-value',
    });

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic' 'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain(
      "connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:* http://host.docker.internal:* ws://localhost:* ws://127.0.0.1:* ws://host.docker.internal:*",
    );
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});
