# Contributing to VeeValve

Thanks for contributing.

## Development Setup

1. Install Node.js 20+ and pnpm 9+.
2. Run `corepack enable`.
3. Run `pnpm install`.
4. Copy `.env.example` to `.env`.
5. Start PostgreSQL (`docker compose up -d postgres`).
6. Generate Prisma client and run migrations:

```bash
pnpm --filter @veevalve/api prisma:generate
pnpm --filter @veevalve/api prisma:migrate
pnpm --filter @veevalve/api prisma:seed
```

7. Start development:

```bash
pnpm dev
```

## Branching

- Branch from `main`
- Use focused branches (`feature/...`, `fix/...`, `chore/...`)

## Pull Requests

- Keep PRs focused and reviewable
- Include tests for new behavior
- Update docs when setup/workflow changes
- Ensure CI passes before requesting review

## Commit Style

Conventional Commits are recommended:
- `feat:`
- `fix:`
- `chore:`
- `docs:`
- `refactor:`
- `test:`

## Code Quality

Run before opening PR:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
