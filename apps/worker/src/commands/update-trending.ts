/**
 * Trending update — reverse approach:
 *
 * Instead of querying GDELT for each of the top-50 scored people (which limits
 * trending to who already has a high score), we:
 *   1. Fetch up to 250 recent GDELT articles for the timespan (1 API call)
 *   2. Match article titles against ALL 100k+ people in the DB via PostgreSQL
 *   3. Rank by article count → true trending regardless of existing score
 *
 * This means a person with no score can still appear in trending if they're
 * in the news.
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

const GDELT_TIMESPANS: Record<string, string> = {
  '1h':  '60',
  '24h': '1440',
  '30d': '43200',
};

async function fetchGDELTArticles(gdeltMinutes: string, maxRecords = 250): Promise<GDELTArticle[]> {
  const params = new URLSearchParams({
    query: 'sourcelang:English',
    mode: 'artlist',
    maxrecords: String(maxRecords),
    format: 'json',
    timespan: gdeltMinutes,
    sort: 'DateDesc',
  });
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: GDELTArticle[] };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

interface MatchedPerson {
  wikidataQid: string;
  displayName: string;
  photoUrl: string | null;
  occupationSummary: string | null;
  popularityScore: number;
  heatScore: number;
  coverageScore: number;
  scoreModelVersion: string;
  calculatedAt: Date;
  articleCount: number;
  articles: Array<{ title: string; url: string; domain: string; seendate: string }>;
}

async function findTrendingPeople(
  articles: GDELTArticle[],
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<MatchedPerson[]> {
  if (articles.length === 0) return [];

  // Concatenate all article titles for PostgreSQL substring search
  const corpus = articles.map(a => a.title).join(' § ');

  // Find people whose full display name (>=8 chars) appears in the corpus.
  // LEFT JOIN latest score snapshot so unscored people can still trend.
  const rows = await db.execute(sql`
    SELECT
      p.id,
      p.wikidata_qid,
      p.display_name,
      p.photo_url,
      p.occupation_summary,
      COALESCE(ss.popularity_score, 0)      AS popularity_score,
      COALESCE(ss.heat_score, 0)            AS heat_score,
      COALESCE(ss.coverage_score, 0)        AS coverage_score,
      COALESCE(ss.score_model_version, 'v1') AS score_model_version,
      COALESCE(ss.calculated_at, NOW())     AS calculated_at
    FROM people p
    LEFT JOIN LATERAL (
      SELECT popularity_score, heat_score, coverage_score, score_model_version, calculated_at
      FROM score_snapshots
      WHERE person_id = p.id
      ORDER BY calculated_at DESC
      LIMIT 1
    ) ss ON true
    WHERE
      length(p.display_name) >= 8
      AND position(lower(p.display_name) IN lower(${corpus})) > 0
    LIMIT 300
  `);

  // Count and attach matching articles per person (done in JS)
  const results: MatchedPerson[] = [];
  for (const row of rows as unknown as Record<string, unknown>[]) {
    const name = String(row['display_name']).toLowerCase();
    const matched = articles.filter(a => a.title.toLowerCase().includes(name));
    if (matched.length === 0) continue;

    results.push({
      wikidataQid:        String(row['wikidata_qid']),
      displayName:        String(row['display_name']),
      photoUrl:           row['photo_url'] ? String(row['photo_url']) : null,
      occupationSummary:  row['occupation_summary'] ? String(row['occupation_summary']) : null,
      popularityScore:    Number(row['popularity_score']),
      heatScore:          Number(row['heat_score']),
      coverageScore:      Number(row['coverage_score']),
      scoreModelVersion:  String(row['score_model_version']),
      calculatedAt:       new Date(String(row['calculated_at'])),
      articleCount:       matched.length,
      articles:           matched.slice(0, 5),
    });
  }

  return results
    .sort((a, b) => b.articleCount - a.articleCount)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 })) as MatchedPerson[];
}

const db = await getDb();

for (const [timespan, gdeltMinutes] of Object.entries(GDELT_TIMESPANS)) {
  process.stdout.write(`[${timespan}] Fetching GDELT articles...`);
  const articles = await fetchGDELTArticles(gdeltMinutes);
  console.log(` ${articles.length} articles fetched`);

  if (articles.length === 0) {
    console.log(`[${timespan}] No articles — skipping`);
    continue;
  }

  process.stdout.write(`[${timespan}] Matching against people DB...`);
  const trending = await findTrendingPeople(articles, db);
  console.log(` ${trending.length} people matched`);

  // Store each entry with its matched articles (for the "Why Trending" person page section)
  const cacheData = trending.map((e, i) => ({
    rank:               i + 1,
    wikidataQid:        e.wikidataQid,
    displayName:        e.displayName,
    photoUrl:           e.photoUrl,
    occupationSummary:  e.occupationSummary,
    popularityScore:    e.popularityScore,
    heatScore:          e.heatScore,
    coverageScore:      e.coverageScore,
    coverageLabel:      'Partial coverage',
    scoreModelVersion:  e.scoreModelVersion,
    calculatedAt:       e.calculatedAt,
    articleCount:       e.articleCount,
    trendingArticles:   e.articles,
  }));

  await db
    .insert(cacheEntries)
    .values({ key: `trending:${timespan}`, data: cacheData, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { data: cacheData, updatedAt: new Date() },
    });

  console.log(`[${timespan}] Stored ${trending.length} trending entries`);
}

// News feed: use articles from 24h window, match to any person in DB
process.stdout.write('\n[news_feed] Fetching articles...');
const feedArticles = await fetchGDELTArticles('1440', 50);
console.log(` ${feedArticles.length} articles`);

const latestScores = db
  .select({
    personId: scoreSnapshots.personId,
    maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
  })
  .from(scoreSnapshots)
  .groupBy(scoreSnapshots.personId)
  .as('latest_scores');

const topPeople = await db
  .select({ wikidataQid: people.wikidataQid, displayName: people.displayName })
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
  .limit(50);

const feed = feedArticles.slice(0, 20).map(a => {
  const matched = topPeople.find(p =>
    a.title.toLowerCase().includes(p.displayName.toLowerCase().split(' ')[0]!),
  ) ?? topPeople[0];
  return {
    title:      a.title,
    url:        a.url,
    domain:     a.domain,
    seendate:   a.seendate,
    personName: matched?.displayName ?? '',
    personQid:  matched?.wikidataQid ?? '',
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
