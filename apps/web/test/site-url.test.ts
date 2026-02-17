import { afterEach, describe, expect, it } from 'vitest';

import { resolveSiteUrl } from '../lib/site-url';

const ORIGINAL_ENV = { ...process.env };

const resetSeoEnv = () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
};

describe('resolveSiteUrl', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('prefers NEXT_PUBLIC_SITE_URL', () => {
    resetSeoEnv();
    process.env.NEXT_PUBLIC_SITE_URL = 'https://veevalve.ee/';

    expect(resolveSiteUrl()).toBe('https://veevalve.ee');
  });

  it('adds https protocol for non-local domains', () => {
    resetSeoEnv();
    process.env.SITE_URL = 'veevalve.ee';

    expect(resolveSiteUrl()).toBe('https://veevalve.ee');
  });

  it('adds http protocol for localhost values', () => {
    resetSeoEnv();
    process.env.VERCEL_URL = 'localhost:3000';

    expect(resolveSiteUrl()).toBe('http://localhost:3000');
  });

  it('falls back to localhost default when nothing is configured', () => {
    resetSeoEnv();

    expect(resolveSiteUrl()).toBe('http://localhost:3000');
  });
});
