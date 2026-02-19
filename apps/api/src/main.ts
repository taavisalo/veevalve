import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AppModule } from './app.module';
import { applyApiSecurityHeaders } from './security/security-headers';

const DEFAULT_API_PORT = 3001;
const DEFAULT_BODY_LIMIT_BYTES = 1_048_576; // 1 MiB
const SWAGGER_UI_PATH = '/docs';
const OPENAPI_JSON_PATH = '/openapi.json';
const DEFAULT_LOCALHOST_CORS_PORTS = [3000, 8081, 8082, 19006];
const DEFAULT_CORS_ORIGINS = DEFAULT_LOCALHOST_CORS_PORTS.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const resolveCorsOrigins = (): Set<string> => {
  const configuredOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (configuredOrigins.length > 0) {
    return new Set(configuredOrigins);
  }

  return new Set(DEFAULT_CORS_ORIGINS);
};

const isSwaggerRouteRequest = (request: FastifyRequest): boolean => {
  const url = request.raw.url ?? request.url;
  const path = url.split('?')[0] ?? '';
  return (
    path === OPENAPI_JSON_PATH ||
    path === SWAGGER_UI_PATH ||
    path.startsWith(`${SWAGGER_UI_PATH}/`)
  );
};

const bootstrap = async (): Promise<void> => {
  const isProduction = process.env.NODE_ENV === 'production';
  const bodyLimit = parsePositiveInteger(
    process.env.BODY_LIMIT_BYTES,
    DEFAULT_BODY_LIMIT_BYTES,
  );
  const allowedCorsOrigins = resolveCorsOrigins();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit,
      logger: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: [
            'req.headers',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
  );
  const openApiConfig = new DocumentBuilder()
    .setTitle('VeeValve API')
    .setDescription('API for public pool and beach water-quality status in Estonia.')
    .setVersion('1.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Sync-Token',
        in: 'header',
        description: 'Required for POST /water-quality/sync when token auth is enabled.',
      },
      'syncToken',
    )
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup(SWAGGER_UI_PATH, app, openApiDocument, {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    raw: ['json'],
    customSiteTitle: 'VeeValve API Docs',
    swaggerOptions: {
      layout: 'BaseLayout',
      persistAuthorization: true,
    },
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (request, _reply, done) => {
    (request as FastifyRequest & { startTimeNs?: bigint }).startTimeNs = process.hrtime.bigint();
    done();
  });

  fastify.addHook('onSend', (_request, reply, payload, done) => {
    const request = _request as FastifyRequest & { startTimeNs?: bigint };
    if (request.startTimeNs) {
      const durationNs = process.hrtime.bigint() - request.startTimeNs;
      const durationMs = Number(durationNs) / 1_000_000;
      const roundedDuration = Math.max(durationMs, 0).toFixed(1);
      reply.header('Server-Timing', `app;dur=${roundedDuration}`);
      reply.header('X-Response-Time', `${roundedDuration}ms`);
    }

    if (!isSwaggerRouteRequest(request)) {
      applyApiSecurityHeaders(reply, isProduction);
    }
    done(null, payload);
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedCorsOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Sync-Token'],
  });

  const port = parsePositiveInteger(process.env.PORT, DEFAULT_API_PORT);
  await app.listen(port, '0.0.0.0');
};

void bootstrap();
