/**
 * Trending update — two-phase approach:
 *
 * Phase 1 (scored people): Batch scored people names into OR queries → GDELT
 *   returns articles mentioning any of them → count per person in JS.
 *   This reliably covers all ~350+ scored people with only 13-ish GDELT calls.
 *
 * Phase 2 (discovery): Broad keyword query → match article titles against
 *   ALL 100k people in DB via PostgreSQL → catches unscored but newsworthy people.
 *
 * Combined result: truly trending people, not just top-50-by-score.
 */

import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, people, scoreSnapshots, cacheEntries } from '@pai/db';
import { desc, eq, and, sql } from 'drizzle-orm';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

interface GDELTArticle {
  title: string;
  url: string;
  domain: string;
  seendate: string;
}

interface ScoredPerson {
  wikidataQid: string;
  displayName: string;
  photoUrl: string | null;
  occupationSummary: string | null;
  popularityScore: number;
  heatScore: number;
  coverageScore: number;
  scoreModelVersion: string;
  calculatedAt: Date;
}

// GDELT artlist timespan in minutes (artlist only accepts integers, not named units)
const GDELT_TIMESPANS: Record<string, string> = {
  '1h':  '60',
  '24h': '1440',
  '30d': '20160', // 14 days — 30d (43200) hits complexity limits with long OR chains
};

const BATCH_SIZE = 25;
const RATE_LIMIT_MS = 6_000;

async function fetchGDELTArticles(query: string, gdeltMinutes: string): Promise<GDELTArticle[]> {
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    maxrecords: '250',
    format: 'json',
    timespan: gdeltMinutes,
    sort: 'DateDesc',
  });
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      process.stderr.write(`  GDELT HTTP ${res.status} for timespan=${gdeltMinutes}\n`);
      return [];
    }
    const text = await res.text();
    // GDELT sometimes returns a rate-limit plain-text message instead of JSON
    if (!text.startsWith('{') && !text.startsWith('[')) {
      process.stderr.write(`  GDELT rate-limited: ${text.slice(0, 80)}\n`);
      return [];
    }
    const data = JSON.parse(text) as { articles?: GDELTArticle[] };
    return data.articles ?? [];
  } catch (err) {
    process.stderr.write(`  GDELT fetch error: ${err}\n`);
    return [];
  }
}

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

function dedupe(articles: GDELTArticle[]): GDELTArticle[] {
  return [...new Map(articles.map(a => [a.url, a])).values()];
}

const db = await getDb();

// Get all scored people (not just top 50 by popularity)
const latestScores = db
  .select({
    personId: scoreSnapshots.personId,
    maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
  })
  .from(scoreSnapshots)
  .groupBy(scoreSnapshots.personId)
  .as('latest_scores');

const scoredPeople: ScoredPerson[] = await db
  .select({
    wikidataQid: people.wikidataQid,
    displayName: people.displayName,
    photoUrl: people.photoUrl,
    occupationSummary: people.occupationSummary,
    popularityScore: scoreSnapshots.popularityScore,
    heatScore: scoreSnapshots.heatScore,
    coverageScore: scoreSnapshots.coverageScore,
    scoreModelVersion: scoreSnapshots.scoreModelVersion,
    calculatedAt: scoreSnapshots.calculatedAt,
  })
  .from(people)
  .innerJoin(latestScores, eq(latestScores.personId, people.id))
  .innerJoin(
    scoreSnapshots,
    and(
      eq(scoreSnapshots.personId, people.id),
      eq(scoreSnapshots.calculatedAt, sql`${latestScores.maxCalcAt}`),
    ),
  )
  .orderBy(desc(scoreSnapshots.popularityScore))
  .limit(500);

if (scoredPeople.length === 0) {
  console.log('No scored people found. Run `pnpm score:calculate` first.');
  process.exit(0);
}

console.log(`Found ${scoredPeople.length} scored people to check.`);

// Per-person news map: accumulated across all timespans for person detail page display
const personNewsMap = new Map<string, GDELTArticle[]>();

// Broad-discovery keywords — returns general news articles that might mention
// newsworthy people who aren't yet scored in our DB.
const DISCOVERY_QUERY =
  'president OR minister OR senator OR CEO OR actor OR singer OR athlete OR champion OR arrested OR elected OR appointed';

for (const [timespan, gdeltMinutes] of Object.entries(GDELT_TIMESPANS)) {
  console.log(`\n[${timespan}] Fetching articles...`);
  const allArticles: GDELTArticle[] = [];
  let callCount = 0;

  // Phase 1: batch queries for scored people names
  const batches: ScoredPerson[][] = [];
  for (let i = 0; i < scoredPeople.length; i += BATCH_SIZE) {
    batches.push(scoredPeople.slice(i, i + BATCH_SIZE));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]!;
    const orQuery = batch.map(p => `"${p.displayName}"`).join(' OR ');
    const articles = await fetchGDELTArticles(orQuery, gdeltMinutes);
    allArticles.push(...articles);
    callCount++;
    process.stdout.write(`  batch ${bi + 1}/${batches.length}: ${articles.length} articles\r`);
    if (bi + 1 < batches.length) await delay(RATE_LIMIT_MS);
  }

  // Phase 2: discovery query for unscored but newsworthy people
  await delay(RATE_LIMIT_MS);
  const discoveryArticles = await fetchGDELTArticles(DISCOVERY_QUERY, gdeltMinutes);
  allArticles.push(...discoveryArticles);
  callCount++;

  const unique = dedupe(allArticles);
  console.log(`  ${callCount} GDELT calls → ${unique.length} unique articles`);

  // Count per scored person (JS string match on title)
  const countMap = new Map<string, GDELTArticle[]>();
  for (const article of unique) {
    const titleLower = article.title.toLowerCase();
    for (const person of scoredPeople) {
      if (titleLower.includes(person.displayName.toLowerCase())) {
        const qid = person.wikidataQid;
        if (!countMap.has(qid)) countMap.set(qid, []);
        countMap.get(qid)!.push(article);
      }
    }
  }

  // Accumulate into global per-person news map (dedup by URL)
  for (const [qid, articles] of countMap) {
    const existing = personNewsMap.get(qid) ?? [];
    const existingUrls = new Set(existing.map(a => a.url));
    for (const article of articles) {
      if (!existingUrls.has(article.url)) {
        existing.push(article);
        existingUrls.add(article.url);
      }
    }
    personNewsMap.set(qid, existing);
  }

  // Phase 2 discovery: match discovery articles against ALL 100k people in DB
  if (discoveryArticles.length > 0) {
    const corpus = discoveryArticles.map(a => a.title).join(' § ');
    const dbMatches = await db.execute(sql`
      SELECT p.wikidata_qid, p.display_name, p.photo_url, p.occupation_summary
      FROM people p
      WHERE
        length(p.display_name) >= 8
        AND position(lower(p.display_name) IN lower(${corpus})) > 0
        AND NOT EXISTS (
          SELECT 1 FROM score_snapshots ss WHERE ss.person_id = p.id
        )
      LIMIT 100
    `);

    for (const row of dbMatches as unknown as Record<string, unknown>[]) {
      const name = String(row['display_name']).toLowerCase();
      const matched = discoveryArticles.filter(a => a.title.toLowerCase().includes(name));
      if (matched.length === 0) continue;
      const qid = String(row['wikidata_qid']);
      if (!countMap.has(qid)) {
        // Insert a synthetic unscored person entry (scores will be 0)
        scoredPeople.push({
          wikidataQid: qid,
          displayName: String(row['display_name']),
          photoUrl: row['photo_url'] ? String(row['photo_url']) : null,
          occupationSummary: row['occupation_summary'] ? String(row['occupation_summary']) : null,
          popularityScore: 0,
          heatScore: 0,
          coverageScore: 0,
          scoreModelVersion: 'v1',
          calculatedAt: new Date(),
        });
        countMap.set(qid, matched);
      }
    }
  }

  const trending = scoredPeople
    .filter(p => (countMap.get(p.wikidataQid)?.length ?? 0) >= 2)
    .map(p => {
      const articles = countMap.get(p.wikidataQid)!;
      // Hybrid rank: article count × (1 + log of popularity) keeps high-profile
      // people ranked above newly-newsworthy zero-scored people with equal articles
      const scoreBoost = 1 + Math.log1p(p.popularityScore) / 10;
      return {
        rank:              0,
        wikidataQid:       p.wikidataQid,
        displayName:       p.displayName,
        photoUrl:          p.photoUrl,
        occupationSummary: p.occupationSummary,
        popularityScore:   p.popularityScore,
        heatScore:         p.heatScore,
        coverageScore:     p.coverageScore,
        coverageLabel:     'Partial coverage',
        scoreModelVersion: p.scoreModelVersion,
        calculatedAt:      p.calculatedAt,
        articleCount:      articles.length,
        trendingScore:     articles.length * scoreBoost,
        trendingArticles:  articles.slice(0, 5),
      };
    })
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  await db
    .insert(cacheEntries)
    .values({ key: `trending:${timespan}`, data: trending, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { data: trending, updatedAt: new Date() },
    });

  console.log(`[${timespan}] Stored ${trending.length} trending entries`);
}

// Store per-person news cache — used by person detail pages to show news without
// calling GDELT live on every visit. Covers all scored people with article matches.
const newsByPerson: Record<string, GDELTArticle[]> = {};
for (const [qid, articles] of personNewsMap) {
  newsByPerson[qid] = articles
    .sort((a, b) => b.seendate.localeCompare(a.seendate))
    .slice(0, 5);
}
await db
  .insert(cacheEntries)
  .values({ key: 'news_by_person', data: newsByPerson, updatedAt: new Date() })
  .onConflictDoUpdate({
    target: cacheEntries.key,
    set: { data: newsByPerson, updatedAt: new Date() },
  });
console.log(`[news_by_person] Stored news for ${Object.keys(newsByPerson).length} people`);

// News feed: latest articles that mention any of our top scored people
console.log('\n[news_feed] Fetching...');
await delay(RATE_LIMIT_MS);
const top8Names = scoredPeople.slice(0, 8).map(p => `"${p.displayName}"`).join(' OR ');
const feedArticles = await fetchGDELTArticles(top8Names, '1440');

const feed = feedArticles.slice(0, 20).map(a => {
  const titleLower = a.title.toLowerCase();
  const matched = scoredPeople.find(p => titleLower.includes(p.displayName.toLowerCase())) ?? scoredPeople[0]!;
  return {
    title:      a.title,
    url:        a.url,
    domain:     a.domain,
    seendate:   a.seendate,
    personName: matched.displayName,
    personQid:  matched.wikidataQid,
  };
});

await db
  .insert(cacheEntries)
  .values({ key: 'news_feed', data: feed, updatedAt: new Date() })
  .onConflictDoUpdate({
    target: cacheEntries.key,
    set: { data: feed, updatedAt: new Date() },
  });

console.log(`[news_feed] Stored ${feed.length} articles`);
console.log('\nTrending update complete!');
