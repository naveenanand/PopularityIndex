/**
 * 1M-scale people importer using name-prefix partitioning.
 *
 * Instead of OFFSET pagination (which stalls on Wikidata past ~50k), this uses
 * 676 two-letter alphabetic prefix buckets (AA–ZZ). Each prefix query has no
 * OFFSET and returns at most 10,000 results, so every call is fast and stable.
 *
 * Throughput: ~4,400 people per prefix × 676 prefixes = ~3M reachable.
 * For 1M records: ~225 prefix queries ≈ 20 minutes.
 *
 * Usage:
 *   pnpm bulk:import:1m             # import up to 1,000,000 people
 *   pnpm bulk:import:1m 500000      # import up to 500,000
 */

import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, makePeopleRepository, makeJobsRepository } from '@pai/db';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const SPARQL_BASE = process.env['WIKIDATA_SPARQL_BASE'] ?? 'https://query.wikidata.org';
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0 bulk-import-1m';
const SPARQL_LIMIT = 5_000;
const UPSERT_BATCH = 200;
const DELAY_MS = 3_000; // polite delay between SPARQL calls

const targetArg = parseInt(process.argv[2] ?? '1000000', 10);
const TARGET = isNaN(targetArg) ? 1_000_000 : targetArg;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface SparqlBinding {
  wikidataQid: { value: string };
  name: { value: string };
}

function buildPrefixQuery(prefix: string): string {
  // Avoid the slow schema:isPartOf join. Use wikibase:sitelinks >= 3 as a proxy
  // for "notable enough to appear on Wikipedia." Much faster, far fewer 504s.
  return `
SELECT ?wikidataQid ?name WHERE {
  ?person wdt:P31 wd:Q5 ;
          wikibase:sitelinks ?sl ;
          rdfs:label ?name .
  FILTER(LANG(?name) = "en" && STRSTARTS(UCASE(?name), ${JSON.stringify(prefix.toUpperCase())}) && ?sl >= 3)
  BIND(REPLACE(STR(?person), "http://www.wikidata.org/entity/", "") AS ?wikidataQid)
}
ORDER BY DESC(?sl)
LIMIT ${SPARQL_LIMIT}
`.trim();
}

async function sparqlFetch(prefix: string, attempt = 1): Promise<Array<{ wikidataQid: string; displayName: string }>> {
  const query = buildPrefixQuery(prefix);
  const url = `${SPARQL_BASE}/sparql?query=${encodeURIComponent(query)}&format=json`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/sparql-results+json' },
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    if (attempt < 4) {
      const wait = attempt * 30_000; // 30s, 60s, 90s
      console.warn(`  [prefix "${prefix}"] network error, retry ${attempt}/3 in ${wait / 1000}s: ${String(err).split('\n')[0]}`);
      await new Promise(r => setTimeout(r, wait));
      return sparqlFetch(prefix, attempt + 1);
    }
    throw err;
  }

  if (!res.ok) {
    if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < 4) {
      const wait = attempt * 30_000; // 30s, 60s, 90s
      console.warn(`  [prefix "${prefix}"] HTTP ${res.status}, retry ${attempt}/3 in ${wait / 1000}s`);
      await new Promise(r => setTimeout(r, wait));
      return sparqlFetch(prefix, attempt + 1);
    }
    throw new Error(`SPARQL ${res.status} for prefix "${prefix}": ${res.statusText}`);
  }

  const data = (await res.json()) as { results: { bindings: SparqlBinding[] } };
  return data.results.bindings
    .filter(b => b.wikidataQid?.value?.startsWith('Q') && b.name?.value)
    .map(b => ({ wikidataQid: b.wikidataQid.value, displayName: b.name.value }));
}

// Generate prefixes in order: AA, AB, ..., AZ, BA, ..., ZZ
function* allPrefixes(): Generator<string> {
  for (const l1 of LETTERS) {
    for (const l2 of LETTERS) {
      yield l1 + l2;
    }
  }
}

const db = await getDb();
const peopleRepo = makePeopleRepository(db);
const jobsRepo = makeJobsRepository(db);
const job = await jobsRepo.startJobRun('bulk_import_1m');

console.log(`[bulk-import-1m job:${job.id}] Target: ${TARGET.toLocaleString()} people`);
console.log(`[job:${job.id}] Strategy: 2-letter prefix partitioning (676 buckets, no OFFSET)`);

let totalAdded = 0, totalSkipped = 0, prefixCount = 0;

try {
  for (const prefix of allPrefixes()) {
    if (totalAdded >= TARGET) break;

    prefixCount++;
    process.stdout.write(`[job:${job.id}] [${prefixCount}/676] prefix="${prefix}" querying...`);

    let candidates: Array<{ wikidataQid: string; displayName: string }>;
    try {
      candidates = await sparqlFetch(prefix);
    } catch (err) {
      console.log(` FAILED: ${String(err).split('\n')[0]}`);
      continue; // skip this prefix and move on
    }

    if (candidates.length === 0) {
      console.log(` 0 results, skipping`);
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    // Truncate to not overshoot TARGET
    const toInsert = candidates.slice(0, TARGET - totalAdded);

    // Upsert in batches
    let batchAdded = 0, batchSkipped = 0;
    for (let i = 0; i < toInsert.length; i += UPSERT_BATCH) {
      const batch = toInsert.slice(i, i + UPSERT_BATCH);
      const results = await Promise.allSettled(
        batch.map(p =>
          peopleRepo.upsertFromWikidata({
            wikidataQid: p.wikidataQid,
            displayName: p.displayName,
            normalizedName: p.displayName.toLowerCase(),
          }),
        ),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') batchAdded++;
        else batchSkipped++;
      }
    }

    totalAdded += batchAdded;
    totalSkipped += batchSkipped;

    const hitLimit = candidates.length === SPARQL_LIMIT;
    console.log(` ${candidates.length} found → +${batchAdded} upserted${hitLimit ? ' (HIT LIMIT — some names in this prefix may be missing)' : ''} | total=${totalAdded.toLocaleString()}`);

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await jobsRepo.completeJobRun(job.id, totalAdded);
  console.log(`\n[job:${job.id}] Done! added=${totalAdded.toLocaleString()} skipped=${totalSkipped} prefixes=${prefixCount}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  await jobsRepo.failJobRun(job.id, message);
  console.error(`[job:${job.id}] Fatal error:`, message);
  process.exit(1);
}
