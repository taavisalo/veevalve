import { describe, expect, it } from 'vitest';

import { buildApiContentSecurityPolicy, getApiSecurityHeaders } from '../src/security/security-headers';

const toHeaderMap = (headers: { key: string; value: string }[]): Map<string, string> => {
  return new Map(headers.map((header) => [header.key, header.value]));
};

describe('api security headers', () => {
  it('sets hardened defaults in production', () => {
    const headers = toHeaderMap(getApiSecurityHeaders(true));

    expect(headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(headers.get('Content-Security-Policy')).toContain('upgrade-insecure-requests');
    expect(headers.get('Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
  });

  it('omits HSTS outside production', () => {
    const headers = toHeaderMap(getApiSecurityHeaders(false));

    expect(headers.has('Strict-Transport-Security')).toBe(false);
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
  });

  it('builds strict API CSP', () => {
    const csp = buildApiContentSecurityPolicy(false);

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});
