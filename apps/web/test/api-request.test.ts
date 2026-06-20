import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveApiBaseUrl } from '../lib/api-request';

const ORIGINAL_ENV = { ...process.env };

const resetApiEnv = () => {
  delete process.env.API_BASE_URL;
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
};

describe('resolveApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('prefers private API_BASE_URL for server-side requests', () => {
    resetApiEnv();
    process.env.API_BASE_URL = 'http://api:3001/';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/';

    expect(resolveApiBaseUrl()).toBe('http://api:3001');
  });

  it('prefers public API URL in browser requests', () => {
    resetApiEnv();
    vi.stubGlobal('window', {});
    process.env.API_BASE_URL = 'http://api:3001/';
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001/';

    expect(resolveApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('falls back to localhost when no API URL is configured', () => {
    resetApiEnv();

    expect(resolveApiBaseUrl()).toBe('http://localhost:3001');
  });
});
