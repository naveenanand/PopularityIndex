# Project Status

**Current Milestone:** Milestone 0 (Repository Setup & Documentation)

**Last Updated:** 2026-06-22

---

## Completed Work

- [x] Git repository initialized on `feature/pai-mvp` branch
- [x] pnpm workspace configured (`pnpm-workspace.yaml`)
- [x] Root tooling: ESLint 10 flat config, Prettier, TypeScript base config
- [x] Docker Compose for local PostgreSQL
- [x] `.env.example` with all required variables
- [x] GitHub Actions CI workflow
- [x] Documentation:
  - `docs/product-spec.md` — product purpose, non-goals, score definitions
  - `docs/architecture.md` — system design, dependency graph, tech choices
  - `docs/scoring-methodology.md` — formulas, re-normalization, limitations
  - `docs/data-source-matrix.md` — provider inventory, API details, future roadmap
  - `docs/entity-resolution-rules.md` — QID-first identity rules
  - `docs/database-schema.md` — all table definitions
  - `docs/risk-and-compliance.md` — licensing, privacy, bias considerations
  - `docs/roadmap.md` — MVP → Phase 4 plan

---

## In Progress

- [ ] Milestone 1: Package scaffolding, Drizzle schema, DB client, seed registry (150 people)

---

## Known Gaps

- pnpm is installed but `pnpm install` has not been run yet (packages not yet created)
- Docker Desktop required for local PostgreSQL — not verified installed
- No source code yet — foundation only

---

## Next Recommended Tasks

1. Scaffold all 6 package `package.json` + `tsconfig.json` files
2. Write Drizzle schema (14 tables across 4 schema files)
3. Configure drizzle.config.ts and generate first migration
4. Write database client with `find-up` env loading
5. Write repository layer (people, observations, scores, jobs)
6. Write seed registry with 150 verified Wikidata QIDs
7. Run `pnpm install` once all package.json files are in place

---

## Blocked Items

None currently.
