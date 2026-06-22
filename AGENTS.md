# AGENTS.md

This file defines project expectations for coding agents working in this repository.

## Project Context

VeeValve is a cross-platform system for public pool/beach water-quality visibility and alerts in Estonia.

Core goals:
- Parse open XML quality data from Terviseamet
- Keep location and quality status data current
- Support guest browsing and authenticated user features
- Deliver status-change and proximity notifications

## Architecture

- Monorepo: `pnpm` + `turbo`
- Apps:
  - `apps/api` (NestJS + Prisma + PostgreSQL)
  - `apps/web` (Next.js)
  - `apps/mobile` (Expo React Native)
- Shared:
  - `packages/core`
  - `packages/ui`

## Primary Rules for Agents

1. Preserve monorepo boundaries.
2. Put business logic in `packages/core` when reusable.
3. Put presentational primitives in `packages/ui` before duplicating UI in apps.
4. Keep API contracts explicit and typed.
5. Keep Estonian (`et`) as default locale; English (`en`) optional.
6. Avoid introducing provider lock-in where not required.
7. Prefer additive changes; avoid breaking public package exports.

## Data and Domain Rules

- Data source is public XML from Terviseamet VTIAV.
- Ingestion is normalized: `Place` -> `WaterQualitySample` -> `WaterQualityProtocol` -> `WaterQualityIndicator`.
- Keep `PlaceLatestStatus` as the primary fast-read path for list/filter endpoints.
- `SourceSyncState` stores per-feed hash/header state and must be updated on every fetch attempt.
- Quality states must be normalized to: `GOOD`, `BAD`, `UNKNOWN`.
- Notifications should be edge-triggered on quality transition, not repeated on unchanged status.
- Location-based notifications must remain opt-in.

## Auth and Privacy

- Guest mode must remain usable.
- Auth providers should support common providers plus Estonia-compatible OIDC.
- Minimize personal data storage; store only fields required for product functionality.

## Delivery Expectations

When making changes:
1. Update tests affected by behavior changes.
2. Update `README.md` if developer workflow changes.
3. Update `.env.example` if new environment variables are introduced.
4. Keep Docker and CI workflows aligned with app scripts.

## Vercel, Performance, and CSP Guardrails

- Production runs as two Vercel projects:
  - `veevalve-web` with root directory `apps/web`
  - `veevalve-api` with root directory `apps/api`
  - Both projects include files outside the root directory during build.
- The web project targets the Vercel Hobby plan. Keep homepage Edge Function bundles under the 1 MB gzip limit. Avoid importing heavy server-only renderers or WASM-backed packages into Edge-rendered pages.
- Do not use dynamic `next/og` `ImageResponse` routes for app-level social images while the homepage is Edge-rendered. Prefer static metadata files such as `apps/web/app/opengraph-image.png`, `apps/web/app/twitter-image.png`, and matching `.alt.txt` files.
- The homepage intentionally exports `runtime = 'edge'` and `preferredRegion = 'home'`. Next.js currently warns that Edge runtime disables static generation for that page; this warning is expected unless the runtime choice changes.
- Production web CSP is strict and nonce-based. Do not add inline `style` attributes, React `style={{ ... }}` props, `element.style` mutations, or `setAttribute('style', ...)` in app/UI code. Use CSS classes, Tailwind utilities, CSS variables defined in stylesheets, or nonced `<style>` tags only when a stylesheet cannot cover the case.
- Keep pnpm-specific install settings out of `.npmrc` so Vercel/npm does not warn about unknown npm project config. Put pnpm workspace settings in `pnpm-workspace.yaml`.
- Before shipping web changes that affect the homepage shell, run a production build and check for CSP-sensitive inline style usage with `rg "style=\\{\\{|style=\\\"|setAttribute\\(['\\\"]style|\\.style\\." apps/web/app apps/web/components apps/web/lib packages/ui/src`.

## Useful Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @veevalve/api prisma:generate
pnpm --filter @veevalve/api prisma:migrate
```

## Definition of Done

A change is done when:
- code compiles (`typecheck`)
- lint is clean
- tests pass
- documentation and env config are updated where needed
