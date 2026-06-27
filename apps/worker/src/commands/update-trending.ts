/**
 * Trending update — Wikipedia pageviews approach (no GDELT).
 *
 * GDELT blocks GitHub Actions and Vercel IPs after 2+ requests.
 * Instead, we use Wikipedia's "top articles" endpoint (same Wikimedia
 * infrastructure we already call for scoring) which has no such limits.
 *
 * Strategy:
 *   trending:1h  → top Wikipedia articles for the current hour
 *   trending:24h → top Wikipedia articles for today
 *   trending:30d → scored people ranked by their stored heatScore
 *
 * If Wikipedia API is unavailable, all tabs fall back to heatScore ranking.
 */

import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, people, scoreSnapshots, cacheEntries } from '@pai/db';
import { desc, eq, and, sql } from 'drizzle-orm';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

interface ScoredPerson {
  personId: number;
  wikidataQid: string;
  displayName: string;
  photoUrl: string | null;
  occupationSummary: string | null;
  popularityScore: number;
  heatScore: number;
  coverageScore: number;
  confidenceScore: number;
  scoreModelVersion: string;
  calculatedAt: Date;
}

interface WikipediaTopArticle {
  article: string; // title with underscores
  views: number;
  rank: number;
}

// Fetch Wikipedia daily top articles (used for 24h trending)
async function fetchWikipediaTop(year: string, month: string, day: string): Promise<WikipediaTopArticle[]> {
  const path = `metrics/pageviews/top/en.wikipedia.org/all-access/${year}/${month}/${day}`;
  const url = `https://wikimedia.org/api/rest_v1/${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.log(`  Wikipedia API ${res.status} for ${path}`);
      return [];
    }
    const data = await res.json() as { items?: Array<{ articles: WikipediaTopArticle[] }> };
    const articles = data.items?.[0]?.articles ?? [];
    console.log(`  Wikipedia API 200 for ${path} → ${articles.length} articles`);
    return articles;
  } catch (err) {
    console.log(`  Wikipedia API error for ${path}:`, err);
    return [];
  }
}

// (1h is handled by the Vercel cron via Google News RSS — removed from worker)

/**
 * Compute live heat from real-time activity — mirrors the cron formula.
 * 1h (Wikipedia views): log10 scale, 1K→50, 10K→67, 100K→83, 1M→100
 * 24h/30d (Wikipedia views — larger absolute numbers than GDELT): same log10 scale
 */
function computeLiveHeat(timespan: string, metricValue: number): number {
  if (timespan === '1h') {
    return Math.min(100, (Math.log10(Math.max(1, metricValue)) / 6) * 100);
  }
  // 24h daily views are much larger — anchor at log10 of typical daily max (~5M)
  return Math.min(100, (Math.log10(Math.max(1, metricValue)) / Math.log10(5_000_000)) * 100);
}

function makeTrendingEntry(
  p: ScoredPerson, i: number, trendingScore: number, articleCount: number,
  timespan: string,
) {
  return {
    rank:              i + 1,
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
    articleCount,
    liveHeat:          computeLiveHeat(timespan, articleCount),
    trendingScore,
    trendingArticles:  [],
  };
}

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

const db = await getDb();

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
    personId: people.id,
    wikidataQid: people.wikidataQid,
    displayName: people.displayName,
    photoUrl: people.photoUrl,
    occupationSummary: people.occupationSummary,
    popularityScore: scoreSnapshots.popularityScore,
    heatScore: scoreSnapshots.heatScore,
    coverageScore: scoreSnapshots.coverageScore,
    confidenceScore: scoreSnapshots.confidenceScore,
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
  .limit(200);

if (scoredPeople.length === 0) {
  console.log('No scored people found. Run `pnpm score:calculate` first.');
  process.exit(0);
}

console.log(`Found ${scoredPeople.length} scored people.`);

// Build a lookup: wikipedia_title → ScoredPerson
// Wikipedia titles use underscores; we normalize display names to match.
const titleToPerson = new Map<string, ScoredPerson>();
for (const p of scoredPeople) {
  titleToPerson.set(p.displayName.replace(/ /g, '_'), p);
}

const now = new Date();
const year  = now.getUTCFullYear().toString();
const month = String(now.getUTCMonth() + 1).padStart(2, '0');
const day   = String(now.getUTCDate()).padStart(2, '0');

const knownTitles = new Set(titleToPerson.keys());

// Filter out non-person Wikipedia system pages
const SYSTEM_PREFIXES = ['Special:', 'Wikipedia:', 'Portal:', 'Help:', 'Template:', 'File:', 'Category:', 'Talk:'];
function isPersonArticle(title: string): boolean {
  return !SYSTEM_PREFIXES.some(p => title.startsWith(p))
    && title !== 'Main_Page'
    && !title.includes('_(disambiguation)');
}

// Auto-discover: look up Wikidata QID for a Wikipedia article title
async function lookupWikidataQid(title: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageprops&ppprop=wikibase_item&format=json&formatversion=2`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      query?: { pages?: Array<{ pageprops?: { wikibase_item?: string }; missing?: boolean }> }
    };
    const page = data.query?.pages?.[0];
    if (!page || page.missing) return null;
    return page.pageprops?.wikibase_item ?? null;
  } catch {
    return null;
  }
}

// Verify a Wikidata QID is a human (P31=Q5) and optionally fetch occupation label
async function fetchHumanInfo(qid: string): Promise<{ isHuman: boolean; occupation: string | null }> {
  const sparql = `SELECT ?isHuman (SAMPLE(?occLabel) AS ?occupation) WHERE {
  BIND(EXISTS { wd:${qid} wdt:P31 wd:Q5 } AS ?isHuman)
  OPTIONAL { wd:${qid} wdt:P106 ?occ . ?occ rdfs:label ?occLabel FILTER(LANG(?occLabel)="en") }
} GROUP BY ?isHuman`;
  try {
    const res = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`,
      { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return { isHuman: false, occupation: null };
    const json = await res.json() as { results: { bindings: Array<Record<string, { value: string }>> } };
    const row = json.results.bindings[0];
    if (!row) return { isHuman: false, occupation: null };
    return {
      isHuman: row['isHuman']?.value === 'true',
      occupation: row['occupation']?.value ?? null,
    };
  } catch {
    return { isHuman: false, occupation: null };
  }
}

// Attempt to add newly discovered people from Wikipedia trending
async function autoDiscoverPeople(
  articles: WikipediaTopArticle[],
  knownTitles: Set<string>,
  minViews = 5_000,
): Promise<number> {
  const unknownHighTraffic = articles
    .filter(a => isPersonArticle(a.article) && !knownTitles.has(a.article) && a.views >= minViews)
    .slice(0, 10); // cap at 10 new people per run to avoid rate-limit bursts

  if (unknownHighTraffic.length === 0) return 0;

  console.log(`\n[discover] Found ${unknownHighTraffic.length} unknown high-traffic articles to investigate...`);

  let added = 0;
  for (const article of unknownHighTraffic) {
    const displayName = article.article.replace(/_/g, ' ');
    const qid = await lookupWikidataQid(article.article);
    await delay(500); // rate-limit courtesy

    if (!qid) {
      console.log(`  [skip] No QID found for "${displayName}"`);
      continue;
    }

    // Check if QID already exists in DB (maybe under a different title)
    const existing = await db.select({ id: people.id }).from(people)
      .where(eq(people.wikidataQid, qid))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  [skip] ${displayName} (${qid}) already in DB`);
      continue;
    }

    // Verify this is a human — skip rivers, cities, films, etc.
    const { isHuman, occupation } = await fetchHumanInfo(qid);
    await delay(500);

    if (!isHuman) {
      console.log(`  [skip] ${displayName} (${qid}) is not a human entity`);
      continue;
    }

    // Insert new person with minimal info — scoring will enrich them
    const normalizedName = displayName.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    await db.insert(people).values({
      wikidataQid: qid,
      displayName,
      normalizedName,
      occupationSummary: occupation,
      photoUrl: null,
    }).onConflictDoNothing();

    console.log(`  [added] ${displayName} (${qid}) — ${article.views.toLocaleString()} views${occupation ? ` · ${occupation}` : ''}`);
    added++;
  }

  return added;
}

// trending:1h is owned by the Vercel cron (Google News RSS).
// This worker runs on GitHub Actions where Wikimedia IPs are rate-limited,
// so we skip 1h entirely to avoid overwriting the Vercel cron's data.
console.log('\n[1h] Skipped — managed by Vercel cron (Google News RSS)');

await delay(2_000);

// --- trending:24h (today's Wikipedia views) ---
console.log('\n[24h] Fetching Wikipedia top articles for today...');
// Note: today's data may lag by ~1h on Wikimedia's API.
// Try today; fall back to yesterday if today isn't available yet.
let dailyArticles = await fetchWikipediaTop(year, month, day);
if (dailyArticles.length === 0) {
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  dailyArticles = await fetchWikipediaTop(
    yesterday.getUTCFullYear().toString(),
    String(yesterday.getUTCMonth() + 1).padStart(2, '0'),
    String(yesterday.getUTCDate()).padStart(2, '0'),
  );
}
console.log(`  → ${dailyArticles.length} Wikipedia articles`);

const dailyMatches = dailyArticles
  .filter(a => isPersonArticle(a.article))
  .filter(a => titleToPerson.has(a.article));

const trending24h = dailyMatches
  .map(a => {
    const p = titleToPerson.get(a.article)!;
    return makeTrendingEntry(p, 0, a.views, a.views, '24h');
  })
  .sort((a, b) => b.liveHeat - a.liveHeat)
  .slice(0, 50)
  .map((e, i) => ({ ...e, rank: i + 1 }));

const trending24hFinal = trending24h.length > 0
  ? trending24h
  : scoredPeople
      .filter(p => p.heatScore > 0)
      .sort((a, b) => b.heatScore - a.heatScore)
      .slice(0, 50)
      .map((p, i) => makeTrendingEntry(p, i, p.heatScore, 0, '24h'));

await db
  .insert(cacheEntries)
  .values({ key: 'trending:24h', data: trending24hFinal, updatedAt: new Date() })
  .onConflictDoUpdate({
    target: cacheEntries.key,
    set: { data: trending24hFinal, updatedAt: new Date() },
  });
console.log(`[24h] Stored ${trending24hFinal.length} entries (${dailyMatches.length} from Wikipedia)`);

await delay(2_000);

// --- trending:30d (heatScore ranking — most stable, updated by score:calculate) ---
console.log('\n[30d] Building from heatScore rankings...');
const trending30d = scoredPeople
  .filter(p => p.heatScore > 0)
  .sort((a, b) => b.heatScore - a.heatScore)
  .slice(0, 50)
  .map((p, i) => makeTrendingEntry(p, i, p.heatScore, 0, '30d'));

await db
  .insert(cacheEntries)
  .values({ key: 'trending:30d', data: trending30d, updatedAt: new Date() })
  .onConflictDoUpdate({
    target: cacheEntries.key,
    set: { data: trending30d, updatedAt: new Date() },
  });
console.log(`[30d] Stored ${trending30d.length} entries`);

// --- news_feed (top articles mentioning our known people, from daily Wikipedia matches) ---
const newsFeed = dailyMatches.slice(0, 20).map(a => {
  const p = titleToPerson.get(a.article)!;
  return {
    title:      `${p.displayName} is trending on Wikipedia`,
    url:        `https://en.wikipedia.org/wiki/${a.article}`,
    domain:     'en.wikipedia.org',
    seendate:   new Date().toISOString().slice(0, 19).replace(/\D/g, '') + '00000',
    personName: p.displayName,
    personQid:  p.wikidataQid,
  };
});

await db
  .insert(cacheEntries)
  .values({ key: 'news_feed', data: newsFeed, updatedAt: new Date() })
  .onConflictDoUpdate({
    target: cacheEntries.key,
    set: { data: newsFeed, updatedAt: new Date() },
  });
console.log(`\n[news_feed] Stored ${newsFeed.length} entries`);

// Auto-discover: add new people from daily Wikipedia trending
const allArticlesForDiscovery = dailyArticles;
const discovered = await autoDiscoverPeople(allArticlesForDiscovery, knownTitles);
if (discovered > 0) {
  console.log(`\n[discover] Added ${discovered} new people. Run \`pnpm score:calculate\` to score them.`);
}

console.log('\nTrending update complete! (Wikipedia-based, no GDELT calls)');
