# VeeValve

VeeValve is a cross-platform app that helps people in Estonia track public beach and pool water quality.

The app is designed for:
- iOS + Android native apps
- web browser access
- guest browsing without account creation
- persistent local favorites and UI preferences (no account required)
- optional future account-based notifications

Primary language is Estonian (`et`) with English (`en`) support.

## What the App Does

- Ingests public water quality data from Terviseamet XML source
- Shows up-to-date status for beaches and pools
- Defaults to 10 latest places; search shows up to 20 results
- Provides predictive search suggestions with fuzzy matching
- Lets users filter by place type and quality status
- Supports local favorites (web `localStorage`, mobile `AsyncStorage`)
- Shows compact metrics and an About panel with source/update details
- Uses status-first cards where BAD entries can expand inline details and open the full Terviseamet report
- Generates backend status-change notifications when new data changes quality state
- Supports browser push notifications for favorites (works even when the web page is closed)

Data source:
- [Terviseamet VTIAV](https://vtiav.sm.ee/index.php/?active_tab_id=A)

## Tech Stack

- Monorepo: `pnpm` + `Turborepo` + TypeScript
- Mobile: Expo + React Native
- Web: Next.js (App Router) + Tailwind CSS
- Backend: NestJS (Fastify adapter) + PostgreSQL + Prisma
- Shared packages:
  - `@veevalve/core` (domain types, i18n helpers, XML parsing utilities)
  - `@veevalve/ui` (web and native UI primitives)
- CI/CD:
  - GitHub Actions for CI
  - GitHub Actions scheduled sync trigger for API
  - EAS Build/Submit for mobile
  - Vercel deployment workflow for web

## Repository Structure

```text
.
├── apps
│   ├── api        # NestJS + Prisma backend
│   ├── mobile     # Expo React Native app (iOS/Android)
│   └── web        # Next.js web app
├── packages
│   ├── core       # Shared domain logic/types/i18n/XML helpers
│   └── ui         # Shared design system components (web/native)
├── docker         # Dev Dockerfiles
└── .github        # CI/CD workflows and contribution templates
```

## Quick Start (Local, Docker)

1. Install Docker Desktop.
2. Start infrastructure and apps:

```bash
docker compose up --build
```

The Docker services use a lock-aware bootstrap script (`docker/scripts/bootstrap.sh`) that installs dependencies only when `pnpm-lock.yaml` changes. This keeps startup faster and avoids repeated package installs.
App-level `node_modules` are mounted as Docker volumes to avoid host/container symlink conflicts in pnpm workspaces.

Services:
- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Postgres: `localhost:5432`
- Expo Metro: `localhost:8081`

The `api` service reads `DATABASE_URL` from your `.env`. If not set, Docker falls back to local Postgres (`postgres:5432`).

To run only database + workspace container:

```bash
docker compose up postgres workspace
```

To start only selected app services after bootstrap:

```bash
docker compose up api
docker compose up web
docker compose up mobile
```

Run migrations inside Docker against local Postgres:

```bash
docker compose up -d postgres workspace
docker compose run --rm \
  -e 'DATABASE_URL=postgresql://veevalve:veevalve@postgres:5432/veevalve?schema=public' \
  api pnpm --filter @veevalve/api prisma:migrate:deploy
```

## Quick Start (Local, Native Toolchain)

Prerequisites:
- Node.js 24.x (LTS)
- pnpm 10+
- Docker (for local PostgreSQL) or a local PostgreSQL instance

1. Install dependencies:

```bash
corepack enable
pnpm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Start PostgreSQL:

```bash
docker compose up -d postgres
```

4. Generate Prisma client and run API migrations:

```bash
pnpm --filter @veevalve/api prisma:generate
pnpm --filter @veevalve/api prisma:migrate
pnpm --filter @veevalve/api prisma:seed
```

Optional migration workflows:

```bash
pnpm --filter @veevalve/api prisma:migrate:create
pnpm --filter @veevalve/api prisma:migrate:deploy
pnpm --filter @veevalve/api prisma:reset
```

5. Start all apps:

```bash
pnpm dev
```

Or start per app:

```bash
pnpm --filter @veevalve/api dev
pnpm --filter @veevalve/web dev
pnpm --filter @veevalve/mobile dev
```

## Environment Variables

See `.env.example` for full defaults.

Important variables:
- `API_BASE_URL`
- `DATABASE_URL`
- `TERVISEAMET_POOL_FACILITIES_URL`
- `TERVISEAMET_POOL_LOCATIONS_URL`
- `TERVISEAMET_BEACH_LOCATIONS_URL`
- `TERVISEAMET_POOL_SAMPLES_URL_TEMPLATE`
- `TERVISEAMET_BEACH_SAMPLES_URL_TEMPLATE`
- `TERVISEAMET_SAMPLE_YEARS_BACK`
- `TERVISEAMET_ALLOWED_HOSTS`
- `NEXT_PUBLIC_API_BASE_URL`
- `CORS_ORIGIN`
- `SYNC_API_TOKEN`
- `ALLOW_UNAUTHENTICATED_SYNC` (dev-only fallback; ignored in production)
- `ENABLE_INTERNAL_SYNC_CRON` (set `false` in production when using external scheduler)
- `SYNC_RATE_LIMIT_MAX`
- `SYNC_RATE_LIMIT_WINDOW_MS`
- `SYNC_RATE_LIMIT_MAX_TRACKED_IPS`
- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`
- `WEB_PUSH_ALLOWED_ENDPOINT_HOSTS`
- `WEB_PUSH_RATE_LIMIT_MAX`
- `WEB_PUSH_RATE_LIMIT_WINDOW_MS`
- `WEB_PUSH_RATE_LIMIT_MAX_TRACKED_IPS`
- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`
- Expo/EAS credentials for production builds

Generate a secure sync token locally:

```bash
pnpm --filter @veevalve/api sync:token
```

Print as `.env` line (for copy/paste):

```bash
pnpm --filter @veevalve/api sync:token -- --env
```

Generate Web Push VAPID keys:

```bash
pnpm --filter @veevalve/api push:vapid -- --env --subject mailto:you@example.com
```

Set the generated keys in API env and set `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` in web env.
Browser push requires HTTPS in production (`localhost` works for local development).

Easier setup (recommended):

```bash
# Print ready-to-copy values
pnpm --filter @veevalve/api push:setup -- --subject mailto:you@example.com
```

The script sets these values:
- API: `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT`
- Web: `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`

## Enable Push Notifications (Web)

1. Open the web app in a supported browser (Chrome, Edge, Firefox).
2. Add one or more places to Favorites.
3. Click the notifications toggle in the top-right controls.
4. Allow browser notification permission when prompted.

Notes:
- Alerts are sent only for favorited places when status changes (`GOOD` <-> `BAD`).
- Notifications continue to work even when the tab is closed.
- If notifications were blocked before, re-enable site notifications in browser settings.
- For production, add the same variables in Vercel project settings:
  - API project env: `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT`
  - Web project env: `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`

## Data Schema

The API uses a normalized Prisma/PostgreSQL schema for Terviseamet open-data ingestion:
- `Place` (canonical pool/beach entity used by app features)
- `PoolFacility`, `PoolProfile`, `BeachProfile` (location metadata)
- `SamplingPoint` (`proovivotukoht`)
- `WaterQualitySample` (`proovivott`)
- `WaterQualityProtocol` (`katseprotokoll`)
- `WaterQualityIndicator` (`naitaja`)
- `PlaceLatestStatus` (fast latest-status lookup for list/filter endpoints)
- `SourceSyncState` (per-feed checksum/header tracking for change detection)

Indexing highlights:
- Latest sample lookup per place: `(placeId, sampledAt DESC)`
- Status filtering and recency: `(overallStatus, sampledAt DESC)` and `(status, sampledAt DESC)`
- Upsert/dedup keys: `(type, externalId)`, `(placeId, externalId)`, `(fileKind, year)`

## Sync Strategy

The sync service pulls:
- `ujulad.xml` (pool facilities)
- `basseinid.xml` (pool locations + sampling points)
- `supluskohad.xml` (beach locations + sampling points)
- `basseini_veeproovid_{year}.xml` (pool samples)
- `supluskoha_veeproovid_{year}.xml` (beach samples)

Change detection:
- Tries conditional requests with `If-None-Match` and `If-Modified-Since`
- Falls back to SHA-256 content hash comparison when headers are not useful
- Stores state in `SourceSyncState`
- Rejects non-HTTPS/non-allowlisted feed URLs (`TERVISEAMET_ALLOWED_HOSTS`, default `vtiav.sm.ee`)

Year handling:
- Automatically checks current year and previous year feeds (`TERVISEAMET_SAMPLE_YEARS_BACK`, default `1`)
- Handles missing yearly files (`404`) without breaking the whole sync

## Feed Frequency Notes

Observed from source data and headers on **February 16, 2026**:
- Response headers are `cache-control: no-store` and do not expose stable `ETag`/`Last-Modified` for reliable incremental polling.
- Pool sample feed (`basseini_veeproovid_2026.xml`) shows near-daily additions:
  - sample date range: `2026-01-05` to `2026-02-12`
  - median gap between sampling days: `1` day
- Beach sample feed (`supluskoha_veeproovid_2025.xml`) is strongly seasonal:
  - sample date range: `2025-05-12` to `2025-10-02`
  - median gap between sampling days: `1` day during season, sparse outside season

Default polling optimization implemented:
- metadata feeds: every 24h
- pool sample feeds: every 2h
- beach sample feeds: every 2h in May-October, otherwise every 24h

## Production Scheduling (Vercel-Friendly)

When deploying the API on serverless platforms, use an external scheduler.

Recommended setup:
- Set `ENABLE_INTERNAL_SYNC_CRON=false` in API production env
- Use GitHub Actions workflow `.github/workflows/api-sync.yml`
- Add repository secrets:
  - `SYNC_API_URL` (for example `https://api.example.com/water-quality/sync`)
  - `SYNC_API_TOKEN` (must match API `SYNC_API_TOKEN`)
- Schedule currently runs every 2 hours (`17 */2 * * *`) and can also be run manually with `workflow_dispatch`

Suggested secure setup flow:
1. Generate a token: `pnpm --filter @veevalve/api sync:token`
2. Set the same value in API env as `SYNC_API_TOKEN`
3. Set the same value in GitHub Actions repository secret `SYNC_API_TOKEN`

## Auth Strategy

Guest mode is supported by default.

For account features (favorites, notifications), OIDC providers are planned:
- Google
- Apple
- Microsoft
- Estonia TARA/eID

Backend identity model supports multiple providers per user.

## Notifications Strategy

- Status change alerts are generated when fresh reading status differs from previous reading
- Notification preference and event tables are in schema
- Expo/mobile push delivery is still planned and not fully wired end-to-end yet

## Quality and Contribution Standards

- Strict TypeScript in all packages
- Shared lint/typecheck/test/build workflows via Turborepo
- Contributor docs: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
- Issue and PR templates in `.github/`

## CI/CD

- `CI`: lint + typecheck + tests + build
- `Deploy Web (Vercel)`: manual (`workflow_dispatch`) production deployment with Vercel secrets
- `Build Mobile (EAS)`: manual (`workflow_dispatch`) build/submit pipeline

## Vercel API Setup

For a dedicated API project on Vercel:
- Framework preset: `NestJS` (or `Other`, but not `Next.js`)
- Root directory: `apps/api`
- Output directory: leave empty

If your API project has many environment variables set in Vercel, `turbo.json` already allowlists them for the `build` task so they are available during build execution.

### Security Headers (MDN Observatory Baseline)

Both deploy targets include hardened security headers by default:
- Web (`apps/web/next.config.ts`): CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, `Origin-Agent-Cluster`, and related hardening headers.
- API (`apps/api/src/main.ts` + `apps/api/src/security/security-headers.ts`): strict API CSP, the same baseline hardening headers, and per-response timing headers.
- `Strict-Transport-Security` (HSTS) is added automatically when `NODE_ENV=production`.

Quick verification after deploy:

```bash
curl -I https://your-web-domain.example
curl -I https://your-api-domain.example/health
```

## Size and Performance Defaults

- Peer auto-install is disabled to avoid pulling unnecessary packages.
- Optional peers are used in shared UI package so web builds do not require native runtime packages.
- Client apps import `@veevalve/core/client` so web/mobile bundles do not include server-only XML parsing code.
- Next.js uses `output: standalone` for smaller production containers.
- Next.js build lint is skipped (`next.config.ts`) because linting runs in dedicated CI/local scripts, reducing build time.
- Mobile package keeps only currently used Expo dependencies; push/location modules can be added when those flows are implemented.
- API Prisma client generation is cached by schema hash to reduce repeated build/dev overhead.
- Docker dev startup avoids re-running `pnpm install` on every service start.

## Performance Smoke Check

Run a fast local latency check for web + API:

```bash
pnpm perf:smoke
```

Defaults:
- Web URL: `http://localhost:3000`
- API URL: `http://localhost:3001`
- Checks first-hit and warm TTFB budgets for `/`, `/places`, `/places?search=...`, `/places/by-ids`, `/places/metrics`

Override URLs or budgets if needed:

```bash
WEB_URL=http://localhost:3100 API_URL=http://localhost:3001 pnpm perf:smoke
BUDGET_WEB_FIRST_TTFB_MS=300 BUDGET_API_SEARCH_TTFB_MS=350 pnpm perf:smoke
```

## Current Status

This repository is an actively implemented MVP, not just a scaffold.

Implemented now:
- Live API-backed web and mobile list/search flows
- XML sync with per-feed interval optimization and change detection
- Production-ready external scheduler flow via GitHub Actions (`POST /water-quality/sync`)
- Normalized PostgreSQL schema with Prisma migrations and seed data
- Metrics endpoint and compact metrics UI (with persisted visibility preferences)
- About panel with source and status explanation
- Local favorites persistence on web and mobile
- Status-first place cards:
  - clear GOOD/BAD/UNKNOWN visual hierarchy
  - BAD details expand inline
  - direct link to full Terviseamet report (`frontpage/show?id=...`)
- API hardening for sync trigger (token + rate limiting)
- Additional hardening: feed host allowlist + HTTPS-only, production-safe sync auth behavior, baseline security headers
- Docker/devcontainer setup and OSS governance docs

Planned next:
1. Add complete auth/session implementation for OIDC providers.
2. Implement full push pipeline (token registration, delivery, retries, observability).
3. Finalize geofencing/location-alert precision with coordinate transformation.
4. Add end-to-end tests for sync -> API -> web/mobile rendering flows.

## License

MIT (see `LICENSE`).
