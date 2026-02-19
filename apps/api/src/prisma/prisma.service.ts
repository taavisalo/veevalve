import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { resolveDatabaseUrl } from './database-url';

const DEFAULT_DB_POOL_MAX = process.env.NODE_ENV === 'production' ? 20 : 10;
const DEFAULT_DB_POOL_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_DB_POOL_MAX_USES = 10_000;
const CONNECT_TIMEOUT_QUERY_PARAM = 'connect_timeout';
const CONNECTION_LIMIT_QUERY_PARAM = 'connection_limit';

const parsePositiveInteger = (value: string | null | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

const readConnectionLimitFromDatabaseUrl = (databaseUrl: string): number | undefined => {
  try {
    const parsedUrl = new URL(databaseUrl);
    return parsePositiveInteger(parsedUrl.searchParams.get(CONNECTION_LIMIT_QUERY_PARAM));
  } catch {
    return undefined;
  }
};

const readConnectTimeoutFromDatabaseUrl = (databaseUrl: string): number | undefined => {
  try {
    const parsedUrl = new URL(databaseUrl);
    const timeoutSeconds = parsePositiveInteger(
      parsedUrl.searchParams.get(CONNECT_TIMEOUT_QUERY_PARAM),
    );
    if (!timeoutSeconds) {
      return undefined;
    }

    return timeoutSeconds * 1000;
  } catch {
    return undefined;
  }
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = resolveDatabaseUrl();
    const connectionLimit = readConnectionLimitFromDatabaseUrl(databaseUrl);
    const connectionTimeoutMs = readConnectTimeoutFromDatabaseUrl(databaseUrl);

    const adapter = new PrismaPg({
      connectionString: databaseUrl,
      max: connectionLimit ?? DEFAULT_DB_POOL_MAX,
      idleTimeoutMillis: DEFAULT_DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: connectionTimeoutMs ?? DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS,
      maxUses: DEFAULT_DB_POOL_MAX_USES,
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
