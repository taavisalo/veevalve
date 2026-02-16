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

Services:
- Web: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Postgres: `localhost:5432`
- Expo Metro: `localhost:8081`

To run only database + workspace container:

```bash
docker compose up postgres workspace
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
- `TERVISEAMET_XML_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `CORS_ORIGIN`
- Expo/EAS credentials for production builds

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
1. Connect XML parser to exact Terviseamet payload structure and map all fields.
2. Build real auth flows (OIDC and session/token lifecycle).
3. Integrate Expo push token registration and delivery pipeline.
4. Implement location geofence checks from real user coordinates.
5. Replace mock data in web/mobile with live API data.

## License

MIT (see `LICENSE`).
