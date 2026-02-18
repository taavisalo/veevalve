import { afterEach, describe, expect, it } from 'vitest';

import { normalizeDatabaseSslMode, resolveDatabaseUrl } from '../src/prisma/database-url';

const ORIGINAL_ENV = { ...process.env };

describe('database url normalization', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;

    expect(() => resolveDatabaseUrl()).toThrow('DATABASE_URL is required to initialize Prisma.');
  });

  it('keeps URL unchanged when sslmode is not set', () => {
    const input = 'postgresql://user:pass@db.example.com:5432/app?schema=public';

    expect(normalizeDatabaseSslMode(input)).toBe(input);
  });

  it('upgrades sslmode=require to sslmode=verify-full', () => {
    const output = normalizeDatabaseSslMode(
      'postgresql://user:pass@db.example.com:5432/app?schema=public&sslmode=require',
    );

    expect(output).toContain('sslmode=verify-full');
    expect(output).toContain('schema=public');
  });

  it('upgrades alias ssl modes to verify-full', () => {
    const prefer = normalizeDatabaseSslMode(
      'postgresql://user:pass@db.example.com:5432/app?sslmode=prefer',
    );
    const verifyCa = normalizeDatabaseSslMode(
      'postgresql://user:pass@db.example.com:5432/app?sslmode=verify-ca',
    );

    expect(prefer).toContain('sslmode=verify-full');
    expect(verifyCa).toContain('sslmode=verify-full');
  });

  it('keeps sslmode when libpq compatibility is explicitly enabled', () => {
    const input =
      'postgresql://user:pass@db.example.com:5432/app?sslmode=require&uselibpqcompat=true';

    expect(normalizeDatabaseSslMode(input)).toBe(input);
  });
});
