FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate && pnpm config set store-dir /pnpm/store
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/core/package.json ./packages/core/package.json
RUN pnpm install --filter @veevalve/api... --frozen-lockfile
COPY . .
RUN pnpm --filter @veevalve/core build
RUN pnpm --filter @veevalve/api prisma:generate
RUN pnpm --filter @veevalve/api build
RUN pnpm --filter @veevalve/api deploy --prod /app/deploy/api

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/deploy/api ./
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/main.js"]
