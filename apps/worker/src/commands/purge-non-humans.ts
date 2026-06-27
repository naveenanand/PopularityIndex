/**
 * Purge non-human entries from the people table.
 *
 * Some Wikipedia articles for events (FIFA World Cup), annual lists
 * (Deaths in 2026), and films slipped in via an older version of
 * auto-discovery before the human-entity check was added.
 *
 * Strategy:
 *   1. Fast pass — delete obvious non-humans by display name pattern
 *      (year-only strings, "Deaths in", "World Cup", " film)", etc.)
 *   2. Wikidata pass — batch-verify remaining QIDs: query Wikidata in
 *      groups of 100 to check P31=Q5 (instance of: human). Delete any
 *      QID that Wikidata does not recognise as a human.
 *
 * Usage:
 *   pnpm purge:non-humans                # full run (both passes)
 *   pnpm purge:non-humans --fast-only    # pattern pass only (quick)
 *   pnpm purge:non-humans --dry-run      # print what would be deleted
 */

import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, people } from '@pai/db';
import { inArray, sql } from 'drizzle-orm';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

const args = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const FAST_ONLY = args.includes('--fast-only');

if (DRY_RUN)   console.log('[purge] DRY RUN — no deletions will be made');
if (FAST_ONLY) console.log('[purge] FAST ONLY — skipping Wikidata verification pass');

const db = await getDb();
if (!db) {
  console.error('No DB connection. Set DATABASE_URL in .env');
  process.exit(1);
}

// ── Pass 1: pattern-based fast cleanup ──────────────────────────────────────

const NON_HUMAN_PATTERNS = [
  /^\d{4}$/,                                    // bare year: "2026"
  /deaths in \d{4}/i,                           // "Deaths in 2026"
  /\bworld cup\b/i,                             // "FIFA World Cup"
  /\bfifa\b/i,                                  // anything FIFA
  /\(\d{4} film\)/i,                            // "Inception (2010 film)"
  /\(\d{4} TV (series|show|film)\)/i,           // "Succession (2018 TV series)"
  /\bseason \d+\b/i,                            // "Breaking Bad season 1"
  /\bchampionship\b/i,                          // "2026 World Championship"
  /\btournament\b/i,
  /\bolympic games?\b/i,
  /\bsummer olympics?\b/i,
  /\bwinter olympics?\b/i,
];

function isObviousNonHuman(name: string): boolean {
  const lower = name.toLowerCase();
  return NON_HUMAN_PATTERNS.some(re => re.test(lower));
}

console.log('\n[purge] Pass 1: pattern-based cleanup...');
const allRows = await db.select({ id: people.id, displayName: people.displayName, wikidataQid: people.wikidataQid }).from(people);
console.log(`  Loaded ${allRows.length.toLocaleString()} people from DB`);

const patternMatches = allRows.filter(r => isObviousNonHuman(r.displayName));
console.log(`  Found ${patternMatches.length} obvious non-humans by name pattern`);

if (patternMatches.length > 0) {
  if (DRY_RUN) {
    console.log('  Would delete:');
    patternMatches.slice(0, 20).forEach(r => console.log(`    ${r.wikidataQid}  ${r.displayName}`));
    if (patternMatches.length > 20) console.log(`    ... and ${patternMatches.length - 20} more`);
  } else {
    const ids = patternMatches.map(r => r.id);
    const CHUNK = 500;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      await db.delete(people).where(inArray(people.id, ids.slice(i, i + CHUNK)));
      deleted += Math.min(CHUNK, ids.length - i);
    }
    console.log(`  Deleted ${deleted} pattern-matched non-humans`);
  }
}

if (FAST_ONLY) {
  console.log('\n[purge] Fast-only mode — done.');
  process.exit(0);
}

// ── Pass 2: Wikidata batch verification ─────────────────────────────────────

// Work from the rows that survived the pattern pass (or all rows in dry-run)
const patternMatchQids = new Set(patternMatches.map(r => r.wikidataQid));
const remaining = allRows.filter(r => !patternMatchQids.has(r.wikidataQid));

console.log(`\n[purge] Pass 2: Wikidata verification for ${remaining.length.toLocaleString()} remaining people...`);
console.log('  (checking P31=Q5 "instance of human" in batches of 100)');

const BATCH = 100;
const DELAY_MS = 400;
const nonHumanQids: string[] = [];

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

async function checkHumanBatch(qids: string[]): Promise<Set<string>> {
  const values = qids.map(q => `wd:${q}`).join(' ');
  const sparql = `SELECT ?person WHERE { VALUES ?person { ${values} } ?person wdt:P31 wd:Q5 . }`;
  try {
    const res = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`,
      { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return new Set(qids); // assume human on error to avoid false deletes
    const json = await res.json() as { results: { bindings: Array<{ person: { value: string } }> } };
    return new Set(
      json.results.bindings.map(b => b.person.value.replace('http://www.wikidata.org/entity/', '')),
    );
  } catch {
    return new Set(qids); // assume human on timeout
  }
}

let checked = 0;
for (let i = 0; i < remaining.length; i += BATCH) {
  const batch = remaining.slice(i, i + BATCH);
  const qids  = batch.map(r => r.wikidataQid);
  const humanQids = await checkHumanBatch(qids);

  for (const r of batch) {
    if (!humanQids.has(r.wikidataQid)) {
      nonHumanQids.push(r.wikidataQid);
    }
  }

  checked += batch.length;
  if (checked % 5000 === 0 || i + BATCH >= remaining.length) {
    console.log(`  Checked ${checked.toLocaleString()} / ${remaining.length.toLocaleString()} — ${nonHumanQids.length} non-humans found so far`);
  }

  await delay(DELAY_MS);
}

console.log(`\n[purge] Wikidata pass complete: ${nonHumanQids.length} non-humans identified`);

if (nonHumanQids.length > 0) {
  if (DRY_RUN) {
    console.log('Would delete QIDs:');
    nonHumanQids.slice(0, 20).forEach(q => {
      const r = remaining.find(x => x.wikidataQid === q);
      console.log(`  ${q}  ${r?.displayName ?? ''}`);
    });
    if (nonHumanQids.length > 20) console.log(`  ... and ${nonHumanQids.length - 20} more`);
  } else {
    const CHUNK = 500;
    let deleted = 0;
    for (let i = 0; i < nonHumanQids.length; i += CHUNK) {
      await db.delete(people).where(
        inArray(people.wikidataQid, nonHumanQids.slice(i, i + CHUNK)),
      );
      deleted += Math.min(CHUNK, nonHumanQids.length - i);
    }
    console.log(`Deleted ${deleted} non-humans confirmed by Wikidata`);
  }
}

const totalRemoved = (DRY_RUN ? 0 : patternMatches.length) + (DRY_RUN ? 0 : nonHumanQids.length);
console.log(`\n[purge] Done. Removed ${totalRemoved.toLocaleString()} non-human entries.`);
if (DRY_RUN) console.log(`[purge] (dry run) Would have removed ${patternMatches.length + nonHumanQids.length} entries`);
