import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { resolveDatabaseUrl } from './database-url';

const DEFAULT_DB_POOL_MAX = process.env.NODE_ENV === 'production' ? 20 : 10;
const DEFAULT_DB_POOL_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_DB_POOL_MAX_USES = 10_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: resolveDatabaseUrl(),
      max: DEFAULT_DB_POOL_MAX,
      idleTimeoutMillis: DEFAULT_DB_POOL_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: DEFAULT_DB_POOL_CONNECTION_TIMEOUT_MS,
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
