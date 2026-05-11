import { describe, expect, it } from 'vitest';

import { normalizeOriginFromUrlLike, resolveCorsOrigins } from '../src/cors';

describe('CORS origin resolution', () => {
  it('normalizes configured origins before matching browser Origin headers', () => {
    const origins = resolveCorsOrigins({
      CORS_ORIGIN: 'https://veevalve.vercel.app/, veevalve.ee, localhost:3000',
    });

    expect(origins.has('https://veevalve.vercel.app')).toBe(true);
    expect(origins.has('https://veevalve.vercel.app/')).toBe(false);
    expect(origins.has('https://veevalve.ee')).toBe(true);
    expect(origins.has('http://localhost:3000')).toBe(true);
  });

  it('uses local development origins when no origin is configured', () => {
    const origins = resolveCorsOrigins({});

    expect(origins.has('http://localhost:3000')).toBe(true);
    expect(origins.has('http://127.0.0.1:8081')).toBe(true);
  });

  it('adds deployed API and web origins from environment URLs', () => {
    const origins = resolveCorsOrigins({
      API_BASE_URL: 'https://veevalve-api.vercel.app/api',
      CORS_ORIGIN: 'https://admin.example.com',
      NEXT_PUBLIC_SITE_URL: 'https://veevalve.vercel.app/',
      VERCEL_PROJECT_PRODUCTION_URL: 'veevalve-api.vercel.app',
      VERCEL_URL: 'veevalve-api-git-main-taavi.vercel.app',
    });

    expect(origins.has('https://admin.example.com')).toBe(true);
    expect(origins.has('https://veevalve.vercel.app')).toBe(true);
    expect(origins.has('https://veevalve-api.vercel.app')).toBe(true);
    expect(origins.has('https://veevalve-api-git-main-taavi.vercel.app')).toBe(true);
  });

  it('ignores invalid origin-like values', () => {
    expect(normalizeOriginFromUrlLike('https://')).toBeNull();
    expect(normalizeOriginFromUrlLike('not a valid host')).toBeNull();
  });

  it('does not use local defaults when configured origins are invalid', () => {
    const origins = resolveCorsOrigins({
      CORS_ORIGIN: 'https://, not a valid host',
    });

    expect(origins.has('http://localhost:3000')).toBe(false);
  });
});
