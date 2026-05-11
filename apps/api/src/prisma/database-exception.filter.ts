import {
  Catch,
  type ArgumentsHost,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BaseExceptionFilter, type HttpAdapterHost } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { isTransientDatabaseError } from './database-error';

type HeaderWritableReply = {
  header?: (name: string, value: string) => unknown;
  setHeader?: (name: string, value: string) => unknown;
};

const RETRY_AFTER_SECONDS = '3';
const UNCACHEABLE_RESPONSE = 'no-store';

@Catch()
export class DatabaseExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  constructor(httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (!isTransientDatabaseError(exception)) {
      super.catch(exception, host);
      return;
    }

    const context = host.switchToHttp();
    const request = context.getRequest<FastifyRequest>();
    const response = context.getResponse<HeaderWritableReply>();

    response?.header?.('Retry-After', RETRY_AFTER_SECONDS);
    response?.header?.('Cache-Control', UNCACHEABLE_RESPONSE);
    response?.setHeader?.('Retry-After', RETRY_AFTER_SECONDS);
    response?.setHeader?.('Cache-Control', UNCACHEABLE_RESPONSE);

    const method = request?.method ?? 'UNKNOWN';
    const url = request?.url ?? request?.raw?.url ?? 'unknown';
    const errorStack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`Transient database connectivity error on ${method} ${url}`, errorStack);

    super.catch(
      new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is temporarily unavailable. Please retry shortly.',
      }),
      host,
    );
  }
}
