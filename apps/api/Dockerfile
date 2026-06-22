FROM node:24-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@10.29.3 --activate && pnpm config set store-dir /pnpm/store
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/core/package.json ./packages/core/package.json
RUN pnpm install --filter @veevalve/api... --frozen-lockfile
COPY . .
RUN pnpm --filter @veevalve/core build
RUN pnpm --filter @veevalve/api prisma:generate
RUN pnpm --filter @veevalve/api build
RUN pnpm --filter @veevalve/api deploy --legacy --prod --no-optional /app/deploy/api
RUN set -eux; \
    generated_prisma_dir="$(find /app/node_modules/.pnpm -path '*/node_modules/.prisma' -type d | head -n 1)"; \
    deployed_client_dir="$(cd /app/deploy/api && node -p "require('path').dirname(require.resolve('@prisma/client/package.json'))")"; \
    cp -R "$generated_prisma_dir" "$(dirname "$(dirname "$deployed_client_dir")")/.prisma"

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/deploy/api/node_modules ./node_modules
COPY --from=build /app/deploy/api/package.json ./package.json
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
USER node
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
