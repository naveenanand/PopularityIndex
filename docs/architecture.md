# Architecture

## Overview

PAI is a pnpm monorepo with two apps and four shared packages.

```
apps/web        Next.js 15 App Router — server-rendered dashboard
apps/worker     Node.js CLI — ingestion and scoring jobs

packages/shared     Shared TypeScript types, Zod schemas, utilities
packages/db         Drizzle ORM schema, migrations, repository layer
packages/scoring    Pure score calculation (no DB imports)
packages/providers  Source adapters: live Wikimedia + mock providers
```

## Dependency Graph

```
@pai/shared  ←─────────────────── (no internal deps)
    ↑
@pai/db          @pai/scoring     @pai/providers
    ↑                ↑                ↑
              @pai/worker  ────────────────
                     ↑
              @pai/web (also imports @pai/db directly for RSC)
```

`@pai/scoring` deliberately has **no dependency on `@pai/db`**. The scoring engine is a pure function that takes a `ScoringFeatures` struct and returns scores. The worker imports both `@pai/db` (to read observations and write snapshots) and `@pai/scoring` (to calculate). This enforces testability and separation of concerns.

## Data Flow

```
Wikidata SPARQL API ──┐
Wikipedia Pageviews ──┤──→ packages/providers ──→ apps/worker (ingest)
Wikipedia Metadata  ──┘                                    │
                                                     pageview_observations
Mock providers ────────────────────────────────────→ source_observations
                                                           │
                                              apps/worker (score:calculate)
                                                           │
                                                 packages/scoring (pure)
                                                           │
                                                    score_snapshots
                                                           │
                                               apps/web (Next.js RSC)
                                                           │
                                                    Browser / User
```

## Key Architectural Decisions

### NodeNext module resolution
All packages except `apps/web` use `moduleResolution: NodeNext`. This requires `.js` extensions on all intra-package TypeScript imports (e.g., `import { foo } from './foo.js'`). `apps/web` uses `Bundler` resolution (required by Next.js 15).

### ESM throughout
All packages use `"type": "module"` to support ESM-only dependencies (`p-limit`, `p-retry`, `find-up`).

### Drizzle ORM + postgresjs
The `postgres` npm package (postgresjs) is used instead of `node-postgres` (`pg`). Postgresjs has superior TypeScript support and integrates better with Drizzle ORM. Migrations live in `packages/db/src/migrations/` (committed to git).

### Server Components for data fetching
Next.js 15 React Server Components fetch data directly from `@pai/db` on the server. No separate REST API is needed for server-rendered pages. Only the search bar requires a Client Component for interactivity.

### Score versioning
All score snapshots include `score_model_version: "v1"`. Future formula changes create a new version. Old snapshots are preserved and queryable.

## Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| Package manager | pnpm 9 | Workspace support, disk efficiency |
| Language | TypeScript 5.x | Type safety across all packages |
| Frontend | Next.js 15 App Router | RSC + streaming, no separate API layer needed |
| Database | PostgreSQL 16 | JSON support (jsonb), reliability |
| ORM | Drizzle | Type-safe, lightweight, PostgreSQL-first |
| Validation | Zod | Runtime + compile-time type safety |
| Charts | Recharts | Maintained React charting library |
| CSS | Tailwind CSS v4 | No config file; CSS-first theming |
| Testing | Vitest | ESM-native, fast, compatible with pnpm workspaces |
| CI | GitHub Actions | Industry standard, free for open source |
