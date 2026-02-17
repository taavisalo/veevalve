import { defineConfig } from 'prisma/config';

const DEFAULT_DATABASE_URL = 'postgresql://veevalve:veevalve@localhost:5432/veevalve?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
});
