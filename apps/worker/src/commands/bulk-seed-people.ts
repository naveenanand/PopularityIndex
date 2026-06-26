/**
 * Bulk seed people from Wikidata.
 *
 * Fetches all humans (P31=Q5) with English Wikipedia pages from Wikidata,
 * ordered by sitelinks count (most notable first), and inserts them into
 * the people table. Runs in batches of 5000 with rate-limit delays.
 *
 * Usage:
 *   pnpm bulk-seed               # insert up to 1M people
 *   pnpm bulk-seed --limit 50000 # insert first 50k most notable
 *   pnpm bulk-seed --offset 100000 --limit 100000  # resume from offset
 *
 * Scoring is NOT run here — people are added with basic info only.
 * The score:calculate job will pick them up based on Wikipedia traffic.
 */

import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, people } from '@pai/db';
import { eq } from 'drizzle-orm';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const BATCH_SIZE = 5_000;
const DELAY_BETWEEN_BATCHES_MS = 3_000;

// Parse CLI args
const args = process.argv.slice(2);
const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
const offsetArg = args.find(a => a.startsWith('--offset='))?.split('=')[1];
const TOTAL_LIMIT = limitArg ? parseInt(limitArg, 10) : 1_000_000;
const START_OFFSET = offsetArg ? parseInt(offsetArg, 10) : 0;

interface WDPerson {
  qid: string;
  name: string;
  occupation: string | null;
}

async function fetchBatch(offset: number, limit: number): Promise<WDPerson[]> {
  // Fetch humans with English Wikipedia pages, sorted by sitelinks (most notable first).
  // We use ?article to require an enwiki page — avoids importing obscure people with
  // no English coverage. Occupation via P106 in the same query to avoid a second call.
  const sparql = `
SELECT DISTINCT ?person ?personLabel (SAMPLE(?occLabel) AS ?occupation) WHERE {
  ?person wdt:P31 wd:Q5 .
  ?article schema:about ?person ;
           schema:inLanguage "en" ;
           schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL {
    ?person wdt:P106 ?occ .
    ?occ rdfs:label ?occLabel FILTER(LANG(?occLabel) = "en")
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
GROUP BY ?person ?personLabel
ORDER BY DESC(STRLEN(STR(?person)))
LIMIT ${limit}
OFFSET ${offset}`;

  try {
    const res = await fetch(
      `${SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`,
      {
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) {
      console.error(`  SPARQL error ${res.status} at offset ${offset}`);
      return [];
    }
    const json = await res.json() as {
      results: { bindings: Array<Record<string, { value: string }>> }
    };
    return json.results.bindings.map(row => {
      const uri = row['person']?.value ?? '';
      const qid = uri.replace('http://www.wikidata.org/entity/', '');
      return {
        qid,
        name: row['personLabel']?.value ?? qid,
        occupation: row['occupation']?.value ?? null,
      };
    }).filter(p => /^Q\d+$/.test(p.qid) && p.name !== p.qid);
  } catch (err) {
    console.error(`  Fetch error at offset ${offset}:`, err);
    return [];
  }
}

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

const db = await getDb();
if (!db) {
  console.error('No DB connection. Set DATABASE_URL in .env');
  process.exit(1);
}

console.log(`\n[bulk-seed] Starting from offset ${START_OFFSET}, target ${TOTAL_LIMIT.toLocaleString()} people`);
console.log(`[bulk-seed] Batch size: ${BATCH_SIZE.toLocaleString()}, delay: ${DELAY_BETWEEN_BATCHES_MS}ms between batches\n`);

let totalInserted = 0;
let totalSkipped = 0;
let offset = START_OFFSET;

while (totalInserted + totalSkipped - START_OFFSET < TOTAL_LIMIT) {
  const batchNum = Math.floor((offset - START_OFFSET) / BATCH_SIZE) + 1;
  console.log(`[batch ${batchNum}] Fetching offset=${offset} limit=${BATCH_SIZE}...`);

  const batch = await fetchBatch(offset, BATCH_SIZE);
  if (batch.length === 0) {
    console.log('[bulk-seed] Empty batch — likely reached end of results. Done.');
    break;
  }

  console.log(`  → ${batch.length} people fetched from Wikidata`);

  // Upsert in DB chunks of 500 to avoid parameter limit
  const CHUNK = 500;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK);
    const values = chunk.map(p => ({
      wikidataQid: p.qid,
      displayName: p.name,
      normalizedName: p.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(),
      occupationSummary: p.occupation,
      photoUrl: null as string | null,
    }));

    // onConflictDoNothing preserves existing rows (display name, photo, etc.)
    const result = await db.insert(people).values(values).onConflictDoNothing();
    // Drizzle postgres.js returns rowCount on insert
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    inserted += count;
    skipped += chunk.length - count;
  }

  totalInserted += inserted;
  totalSkipped += skipped;
  offset += BATCH_SIZE;

  console.log(`  → inserted ${inserted}, skipped ${skipped} (already in DB)`);
  console.log(`  → running total: ${totalInserted.toLocaleString()} inserted, ${totalSkipped.toLocaleString()} skipped`);

  if (batch.length < BATCH_SIZE) {
    console.log('[bulk-seed] Last batch was smaller than limit — reached end of results.');
    break;
  }

  await delay(DELAY_BETWEEN_BATCHES_MS);
}

console.log(`\n[bulk-seed] Complete!`);
console.log(`  Total inserted: ${totalInserted.toLocaleString()}`);
console.log(`  Total skipped:  ${totalSkipped.toLocaleString()}`);
console.log(`  Run \`pnpm score:calculate\` to score the most active people.`);
