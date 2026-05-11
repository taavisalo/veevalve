import { describe, expect, it } from 'vitest';

import { isTransientDatabaseError } from '../src/prisma/database-error';

describe('isTransientDatabaseError', () => {
  it('recognizes pg connection timeout errors by message', () => {
    const error = new Error('Connection terminated due to connection timeout');

    expect(isTransientDatabaseError(error)).toBe(true);
  });

  it('recognizes nested transient causes from adapter errors', () => {
    const error = {
      message: 'Prisma adapter query failed',
      cause: new Error('Connection terminated unexpectedly'),
    };

    expect(isTransientDatabaseError(error)).toBe(true);
  });

  it('recognizes transient prisma error codes', () => {
    const error = { code: 'P2024', message: 'Timed out fetching a new connection from the pool' };

    expect(isTransientDatabaseError(error)).toBe(true);
  });

  it('recognizes transient prisma initialization error codes', () => {
    const error = {
      errorCode: 'P1001',
      message: "Can't reach database server",
      name: 'PrismaClientInitializationError',
    };

    expect(isTransientDatabaseError(error)).toBe(true);
  });

  it('recognizes transient node/postgres connection codes', () => {
    const error = { code: 'ETIMEDOUT', message: 'socket hang up' };

    expect(isTransientDatabaseError(error)).toBe(true);
  });

  it('does not classify unrelated errors as transient database failures', () => {
    const error = new Error('Validation failed');

    expect(isTransientDatabaseError(error)).toBe(false);
  });

  it('does not classify permanent prisma initialization errors as transient', () => {
    const error = {
      errorCode: 'P1000',
      message: 'Authentication failed against database server',
      name: 'PrismaClientInitializationError',
    };

    expect(isTransientDatabaseError(error)).toBe(false);
  });
});
