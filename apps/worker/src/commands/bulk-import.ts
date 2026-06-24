/**
 * Bulk-import people from Wikidata SPARQL.
 * Does NOT fetch photos (use `pnpm update:photos` afterward to backfill).
 *
 * Usage:
 *   pnpm bulk:import            # import up to 10 000 people
 *   pnpm bulk:import 50000      # import up to 50 000
 *   pnpm bulk:import 1000000    # import up to 1 000 000 (very slow — run overnight)
 */

import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, makePeopleRepository, makeJobsRepository } from '@pai/db';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const SPARQL_BASE = process.env['WIKIDATA_SPARQL_BASE'] ?? 'https://query.wikidata.org';
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0 bulk-import';
const PAGE_SIZE = 500;
const targetArg = parseInt(process.argv[2] ?? '10000', 10);
const TARGET = isNaN(targetArg) ? 10_000 : targetArg;

interface SparqlBinding {
  wikidataQid: { value: string };
  name: { value: string };
}

function buildQuery(offset: number, limit: number): string {
  return `
SELECT ?wikidataQid ?name WHERE {
  ?person wdt:P31 wd:Q5 .
  ?enwiki schema:about ?person ;
          schema:isPartOf <https://en.wikipedia.org/> .
  ?person rdfs:label ?name .
  FILTER(LANG(?name) = "en")
  BIND(REPLACE(STR(?person), "http://www.wikidata.org/entity/", "") AS ?wikidataQid)
}
LIMIT ${limit}
OFFSET ${offset}
`.trim();
}

async function fetchPage(offset: number): Promise<Array<{ wikidataQid: string; displayName: string; occupation?: string }>> {
  const query = buildQuery(offset, PAGE_SIZE);
  const url = `${SPARQL_BASE}/sparql?query=${encodeURIComponent(query)}&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status} at offset ${offset}: ${res.statusText}`);
  const data = (await res.json()) as { results: { bindings: SparqlBinding[] } };
  return data.results.bindings
    .filter(b => b.wikidataQid?.value?.startsWith('Q') && b.name?.value)
    .map(b => ({
      wikidataQid: b.wikidataQid.value,
      displayName: b.name.value,
    }));
}

const db = await getDb();
const peopleRepo = makePeopleRepository(db);
const jobsRepo = makeJobsRepository(db);
const job = await jobsRepo.startJobRun('bulk_import');

console.log(`[bulk-import job:${job.id}] Target: ${TARGET.toLocaleString()} people`);

let added = 0, skipped = 0, offset = 0;
const UPSERT_BATCH = 100;

try {
  while (offset < TARGET) {
    const toFetch = Math.min(PAGE_SIZE, TARGET - offset);
    console.log(`[job:${job.id}] Fetching SPARQL page: offset=${offset} limit=${toFetch}...`);

    let candidates: Awaited<ReturnType<typeof fetchPage>>;
    let retries = 0;
    while (true) {
      try {
        candidates = await fetchPage(offset);
        break;
      } catch (err) {
        retries++;
        if (retries >= 3) {
          console.warn(`[job:${job.id}] SPARQL failed 3 times at offset=${offset}, stopping.`);
          await jobsRepo.completeJobRun(job.id, added);
          console.log(`[job:${job.id}] Partial complete: added=${added} at offset=${offset}`);
          process.exit(0);
        }
        const wait = retries * 10_000;
        console.warn(`[job:${job.id}] SPARQL error (attempt ${retries}/3), retrying in ${wait / 1000}s...`, String(err).split('\n')[0]);
        await new Promise(r => setTimeout(r, wait));
      }
    }

    if (candidates.length === 0) {
      console.log(`[job:${job.id}] No more results at offset=${offset}. Done.`);
      break;
    }

    // Upsert in small batches
    for (let i = 0; i < candidates.length; i += UPSERT_BATCH) {
      const batch = candidates.slice(i, i + UPSERT_BATCH);
      const results = await Promise.allSettled(
        batch.map(p =>
          peopleRepo.upsertFromWikidata({
            wikidataQid: p.wikidataQid,
            displayName: p.displayName,
            normalizedName: p.displayName.toLowerCase(),
            ...(p.occupation ? { occupationSummary: p.occupation } : {}),
          }),
        ),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') added++;
        else skipped++;
      }
    }

    console.log(`[job:${job.id}] offset=${offset}: imported ${candidates.length} (total=${added})`);
    offset += candidates.length;

    if (candidates.length < PAGE_SIZE) {
      console.log(`[job:${job.id}] Reached end of Wikidata results.`);
      break;
    }

    // Polite delay between SPARQL pages to avoid rate limiting
    await new Promise(r => setTimeout(r, 2_000));
  }

  await jobsRepo.completeJobRun(job.id, added);
  console.log(`[job:${job.id}] Complete: added=${added} skipped=${skipped} total_offset=${offset}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  await jobsRepo.failJobRun(job.id, message);
  console.error(`[job:${job.id}] Failed:`, message);
  process.exit(1);
}
