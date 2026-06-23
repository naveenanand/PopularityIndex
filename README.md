# Public Attention Index (PAI)

PAI assigns a transparent public-attention score to people with Wikipedia biographies. It measures public visibility and attention — not talent, moral worth, or personal value.

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Docker Desktop** — [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) (for local PostgreSQL)
- **pnpm 9** — installed via npm (see step 1)

## Quick Start

```bash
# 1. Install pnpm (if not already installed)
npm install -g pnpm@9

# 2. Clone the repo and install dependencies
git clone <repo-url>
cd PopularityIndex
pnpm install

# 3. Copy the environment file
cp .env.example .env
# Edit .env to set WIKIMEDIA_USER_AGENT to include your contact email

# 4. Start PostgreSQL
docker compose up -d

# 5. Run database migrations
pnpm db:migrate

# 6. Seed the database (~150 people)
pnpm db:seed

# 7. Ingest Wikipedia data (live Wikimedia APIs)
pnpm ingest:wikipedia

# 8. Calculate scores
pnpm score:calculate

# 9. Start the web app
pnpm dev
# Open http://localhost:3000
```

## All Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `docker compose up -d` | Start local PostgreSQL |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed ~150 people with Wikidata QIDs |
| `pnpm ingest:wikipedia` | Fetch Wikipedia pageview data for all seeded people |
| `pnpm score:calculate` | Calculate and store scores for all people |
| `pnpm dev` | Start Next.js development server |
| `pnpm build` | Build all packages and the web app |
| `pnpm test` | Run Vitest unit tests |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |

## Data Sources

The MVP uses these data sources:

| Source | Status |
|---|---|
| Wikidata metadata | Live (Wikimedia public API) |
| Wikipedia pageviews | Live (Wikimedia public API) |
| Wikipedia article metadata | Live (MediaWiki public API) |
| Search interest | Mock (labeled in UI) |
| News coverage | Mock (labeled in UI) |
| Social reach | Mock (labeled in UI) |
| Sentiment | Mock (labeled in UI) |

All mock data is clearly labeled in the web dashboard. Mock data is never presented as live production data.

## Scores

**Popularity Score (0–100):** Sustained public visibility across multiple signals.

**Heat Score (0–100):** Recent acceleration in attention vs the person's own baseline.

**Sentiment:** Positive / neutral / negative tone of public discussion. Displayed separately — never included in Popularity or Heat.

See [docs/scoring-methodology.md](docs/scoring-methodology.md) for full formulas and limitations.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the system design.

```
apps/web      Next.js 15 App Router dashboard
apps/worker   Node.js CLI for ingestion + scoring

packages/shared     Shared types, Zod schemas
packages/db         Drizzle ORM + PostgreSQL
packages/scoring    Pure scoring engine (no DB)
packages/providers  Wikimedia live + mock providers
```

## Limitations

- In the MVP, only Wikipedia signals are live. Search, news, social, and sentiment data are mocked.
- Scores improve substantially when real providers are configured.
- PAI scores measure public attention only. They do not reflect importance, talent, or moral worth.
- See [docs/risk-and-compliance.md](docs/risk-and-compliance.md) for full limitations.
