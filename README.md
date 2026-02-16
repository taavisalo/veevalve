# VeeValve

VeeValve is a cross-platform app that helps people in Estonia track public beach and pool water quality.

The app is designed for:
- iOS + Android native apps
- web browser access
- guest browsing without account creation
- optional account-based favorites and notifications

Primary language is Estonian (`et`) with English (`en`) support.

## What the App Does

- Ingests public water quality data from Terviseamet XML source
- Shows up-to-date status for beaches and pools
- Lets users filter and browse locations
- Supports favorites and notification preferences
- Sends quality-change alerts (good -> bad, bad -> good)
- Supports optional location-based alerts when users are near monitored places

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
- API: `http://localhost:3001/api`
- Postgres: `localhost:5432`
- Expo Metro: `localhost:8081`

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

## Quick Start (Local, Native Toolchain)

Prerequisites:
- Node.js 20+
- pnpm 9+
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
- `DATABASE_URL`
- `TERVISEAMET_POOL_FACILITIES_URL`
- `TERVISEAMET_POOL_LOCATIONS_URL`
- `TERVISEAMET_BEACH_LOCATIONS_URL`
- `TERVISEAMET_POOL_SAMPLES_URL_TEMPLATE`
- `TERVISEAMET_BEACH_SAMPLES_URL_TEMPLATE`
- `TERVISEAMET_SAMPLE_YEARS_BACK`
- `NEXT_PUBLIC_API_BASE_URL`
- `CORS_ORIGIN`
- Expo/EAS credentials for production builds

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
- Location alerts are user-controlled and can be disabled
- Mobile push is the primary channel (Expo push integration scaffolded)

## Quality and Contribution Standards

- Strict TypeScript in all packages
- Shared lint/typecheck/test/build workflows via Turborepo
- Contributor docs: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
- Issue and PR templates in `.github/`

## CI/CD

- `CI`: lint + typecheck + tests + build
- `Deploy Web (Vercel)`: production deployment with Vercel secrets
- `Build Mobile (EAS)`: workflow-dispatch build/submit pipeline

## Size and Performance Defaults

- Peer auto-install is disabled to avoid pulling unnecessary packages.
- Optional peers are used in shared UI package so web builds do not require native runtime packages.
- Next.js uses `output: standalone` for smaller production containers.
- API Prisma client generation is cached by schema hash to reduce repeated build/dev overhead.
- Docker dev startup avoids re-running `pnpm install` on every service start.

## Current Status

This repository is a production-oriented scaffold.

Already included:
- Monorepo architecture and tooling
- Mobile/web/api app shells
- Prisma schema for domain entities
- XML ingest service skeleton
- Shared UI and domain packages
- Docker + Dev Container setup
- Open-source project governance files

Next implementation steps:
1. Add WGS84 coordinate transformation from source coordinate system for geofence precision.
2. Build real auth flows (OIDC and session/token lifecycle).
3. Integrate Expo push token registration and delivery pipeline.
4. Replace mock data in web/mobile with live API data.
5. Add advanced place/sample detail endpoints for protocol and indicator drill-down UI.

## License

MIT (see `LICENSE`).
