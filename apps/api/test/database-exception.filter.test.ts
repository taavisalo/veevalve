import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { DatabaseExceptionFilter } from '../src/prisma/database-exception.filter';

const createHttpHost = (response: unknown): ArgumentsHost =>
  ({
    getArgByIndex: (index: number) => (index === 1 ? response : undefined),
    getArgs: () => [],
    getType: () => 'http',
    switchToHttp: () => ({
      getNext: () => undefined,
      getRequest: () => ({
        method: 'GET',
        url: '/places/metrics',
      }),
      getResponse: () => response,
    }),
    switchToRpc: () => ({
      getContext: () => undefined,
      getData: () => undefined,
    }),
    switchToWs: () => ({
      getClient: () => undefined,
      getData: () => undefined,
      getPattern: () => undefined,
    }),
  }) as unknown as ArgumentsHost;

describe('DatabaseExceptionFilter', () => {
  it('marks transient database errors as uncacheable service-unavailable responses', () => {
    const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const response = {
      header: vi.fn(),
      setHeader: vi.fn(),
    };
    const httpAdapter = {
      end: vi.fn(),
      isHeadersSent: vi.fn(() => false),
      reply: vi.fn(),
    };
    const filter = new DatabaseExceptionFilter({ httpAdapter } as never);

    filter.catch(
      new Error('Connection terminated due to connection timeout'),
      createHttpHost(response),
    );

    expect(response.header).toHaveBeenCalledWith('Retry-After', '3');
    expect(response.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '3');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is temporarily unavailable. Please retry shortly.',
        statusCode: 503,
      },
      503,
    );

    loggerSpy.mockRestore();
  });
});
