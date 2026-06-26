/**
 * Bulk-import people from Wikipedia's "Living people" category via MediaWiki API.
 *
 * Much more reliable than Wikidata SPARQL — Wikipedia's API handles hundreds of
 * requests/second, supports continuation tokens, and returns Wikidata QIDs directly
 * via the wikibase_item page prop.
 *
 * Throughput: 500 people per call, ~1s delay = ~3-4 minutes for 100k people.
 *
 * Usage:
 *   pnpm bulk:import:wp            # import up to 100,000 people
 *   pnpm bulk:import:wp 50000      # import up to 50,000
 */

import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, makePeopleRepository, makeJobsRepository } from '@pai/db';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0 (bulk-import)';
const API_BASE = 'https://en.wikipedia.org/w/api.php';
const PAGE_LIMIT = 500;
const UPSERT_BATCH = 200;
const DELAY_MS = 1_000;

const targetArg = parseInt(process.argv[2] ?? '100000', 10);
const TARGET = isNaN(targetArg) ? 100_000 : targetArg;

// Categories to pull from, in order
const CATEGORIES = [
  'Living_people',
  'American_people',
  'British_people',
  '21st-century_people',
  'Heads_of_state',
  'Olympic_gold_medalists',
];

interface WikiPage {
  title: string;
  pageprops?: { wikibase_item?: string };
}

interface ApiResponse {
  query?: { pages?: Record<string, WikiPage> };
  continue?: Record<string, string>;
}

async function fetchCategoryPage(
  category: string,
  continueToken?: Record<string, string>,
  attempt = 1,
): Promise<{ pages: Array<{ title: string; qid: string }>; next?: Record<string, string> }> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: `Category:${category}`,
    gcmlimit: String(PAGE_LIMIT),
    gcmnamespace: '0', // articles only
    gcmtype: 'page',
    prop: 'pageprops',
    ppprop: 'wikibase_item',
    format: 'json',
    formatversion: '2',
    ...(continueToken ?? {}),
  });

  const url = `${API_BASE}?${params}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (attempt < 4) {
      const wait = attempt * 10_000;
      console.warn(`  [${category}] network error, retry ${attempt}/3 in ${wait / 1000}s`);
      await new Promise(r => setTimeout(r, wait));
      return fetchCategoryPage(category, continueToken, attempt + 1);
    }
    throw err;
  }

  if (!res.ok) {
    if ((res.status === 429 || res.status === 503) && attempt < 4) {
      const wait = attempt * 15_000;
      console.warn(`  [${category}] HTTP ${res.status}, retry ${attempt}/3 in ${wait / 1000}s`);
      await new Promise(r => setTimeout(r, wait));
      return fetchCategoryPage(category, continueToken, attempt + 1);
    }
    throw new Error(`Wikipedia API ${res.status} for category "${category}"`);
  }

  const data = (await res.json()) as ApiResponse;
  const rawPages = Object.values(data.query?.pages ?? {});

  const pages = rawPages
    .filter(p => p.pageprops?.wikibase_item?.startsWith('Q'))
    .map(p => ({ title: p.title, qid: p.pageprops!.wikibase_item! }));

  return { pages, ...(data.continue !== undefined ? { next: data.continue } : {}) };
}

const db = await getDb();
const peopleRepo = makePeopleRepository(db);
const jobsRepo = makeJobsRepository(db);
const job = await jobsRepo.startJobRun('bulk_import_wikipedia');

console.log(`[bulk-import-wp job:${job.id}] Target: ${TARGET.toLocaleString()} people`);
console.log(`[job:${job.id}] Source: Wikipedia category API (no SPARQL, no rate limits)`);

let totalAdded = 0, totalSkipped = 0, callCount = 0;

try {
  outer: for (const category of CATEGORIES) {
    if (totalAdded >= TARGET) break;

    console.log(`\n[job:${job.id}] === Category: ${category} ===`);
    let continueToken: Record<string, string> | undefined = undefined;

    while (true) {
      if (totalAdded >= TARGET) break outer;

      callCount++;
      process.stdout.write(`[job:${job.id}] call #${callCount} (total=${totalAdded.toLocaleString()})...`);

      let result: Awaited<ReturnType<typeof fetchCategoryPage>>;
      try {
        result = await fetchCategoryPage(category, continueToken);
      } catch (err) {
        console.log(` FAILED: ${String(err).split('\n')[0]}`);
        break; // move to next category
      }

      const { pages, next } = result;

      if (pages.length === 0) {
        console.log(` 0 results`);
        break;
      }

      const toInsert = pages.slice(0, TARGET - totalAdded);

      let batchAdded = 0, batchSkipped = 0;
      for (let i = 0; i < toInsert.length; i += UPSERT_BATCH) {
        const batch = toInsert.slice(i, i + UPSERT_BATCH);
        const results = await Promise.allSettled(
          batch.map(p =>
            peopleRepo.upsertFromWikidata({
              wikidataQid: p.qid,
              displayName: p.title,
              normalizedName: p.title.toLowerCase(),
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
      console.log(` +${batchAdded} upserted | total=${totalAdded.toLocaleString()}`);

      if (!next || totalAdded >= TARGET) break;
      continueToken = next;
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  await jobsRepo.completeJobRun(job.id, totalAdded);
  console.log(`\n[job:${job.id}] Done! added=${totalAdded.toLocaleString()} skipped=${totalSkipped} api_calls=${callCount}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  await jobsRepo.failJobRun(job.id, message);
  console.error(`[job:${job.id}] Fatal error:`, message);
  process.exit(1);
}
