import { eq, desc, asc, ilike, or, and, sql, count, inArray } from 'drizzle-orm';
import {
  people,
  personAliases,
  scoreSnapshots,
  pageviewObservations,
  sourceObservations,
  cacheEntries,
} from '@pai/db';
import type { ScoreExplanation } from '@pai/shared';
import { db } from './db';

export interface LeaderboardEntry {
  rank: number;
  wikidataQid: string;
  displayName: string;
  occupationSummary: string | null;
  popularityScore: number;
  heatScore: number;
  coverageScore: number;
  coverageLabel: string;
  scoreModelVersion: string;
  calculatedAt: Date;
  photoUrl: string | null;
}

export interface PersonWithScores {
  person: {
    id: number;
    wikidataQid: string;
    displayName: string;
    occupationSummary: string | null;
    photoUrl: string | null;
  };
  latestScore: {
    popularityScore: number;
    heatScore: number;
    sentimentScore: number | null;
    controversyScore: number | null;
    coverageScore: number;
    confidenceScore: number;
    calculatedAt: Date;
    explanationJson: ScoreExplanation;
  } | null;
  scoreHistory: Array<{
    calculatedAt: Date;
    popularityScore: number;
    heatScore: number;
  }>;
}

export interface BrowsePerson {
  id: number;
  wikidataQid: string;
  displayName: string;
  occupationSummary: string | null;
}

export interface FeedArticle {
  title: string;
  url: string;
  domain: string;
  seendate: string;
  personName: string;
  personQid: string;
}

export interface NewsArticle {
  title: string;
  url: string;
  domain: string;
  seendate: string;
}

export interface TrendingEntry extends LeaderboardEntry {
  articleCount: number;
}

export interface ViewPerson {
  wikidataQid: string;
  displayName: string;
  photoUrl?: string | null;
  occupationSummary?: string | null;
  rank: number;
  primaryScore: number;
  primaryLabel: string;
  primaryColor: string;
  secondaryScore?: number;
  secondaryLabel?: string;
  secondaryColor?: string;
  badge?: string;
}

function buildLeaderboardBase(
  conn: NonNullable<Awaited<ReturnType<typeof db>>>,
  sortBy: 'popularity' | 'heat',
) {
  const sortCol = sortBy === 'heat' ? scoreSnapshots.heatScore : scoreSnapshots.popularityScore;
  const latestScores = conn
    .select({
      personId: scoreSnapshots.personId,
      maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
    })
    .from(scoreSnapshots)
    .groupBy(scoreSnapshots.personId)
    .as('latest_scores');
  return { sortCol, latestScores };
}

// Reads photo_url from DB — no external API calls at render time.
// Run `pnpm update:photos` to backfill photo URLs into the DB.
export async function getLeaderboard(
  sortBy: 'popularity' | 'heat' = 'popularity',
  limit = 50,
  offset = 0,
): Promise<LeaderboardEntry[]> {
  const conn = await db();
  if (!conn) return [];

  const { sortCol, latestScores } = buildLeaderboardBase(conn, sortBy);

  const rows = await conn
    .select({
      person: {
        id: people.id,
        wikidataQid: people.wikidataQid,
        displayName: people.displayName,
        occupationSummary: people.occupationSummary,
        photoUrl: people.photoUrl,
      },
      score: scoreSnapshots,
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
    .orderBy(desc(sortCol))
    .limit(limit)
    .offset(offset);

  return rows.map((row, idx) => {
    const explanation = row.score.explanationJson as ScoreExplanation;
    return {
      rank: offset + idx + 1,
      wikidataQid: row.person.wikidataQid,
      displayName: row.person.displayName,
      occupationSummary: row.person.occupationSummary,
      popularityScore: row.score.popularityScore,
      heatScore: row.score.heatScore,
      coverageScore: row.score.coverageScore,
      coverageLabel: explanation?.coverage_label ?? 'Partial coverage',
      scoreModelVersion: row.score.scoreModelVersion,
      calculatedAt: row.score.calculatedAt,
      photoUrl: row.person.photoUrl ?? null,
    };
  });
}

export async function getPersonWithScores(wikidataQid: string): Promise<PersonWithScores | null> {
  const conn = await db();
  if (!conn) return null;

  const personRows = await conn
    .select({
      id: people.id,
      wikidataQid: people.wikidataQid,
      displayName: people.displayName,
      occupationSummary: people.occupationSummary,
      photoUrl: people.photoUrl,
    })
    .from(people)
    .where(eq(people.wikidataQid, wikidataQid))
    .limit(1);

  const person = personRows[0];
  if (!person) return null;

  const allScores = await conn
    .select()
    .from(scoreSnapshots)
    .where(eq(scoreSnapshots.personId, person.id))
    .orderBy(desc(scoreSnapshots.calculatedAt))
    .limit(30);

  const latestRaw = allScores[0];
  const latestScore = latestRaw
    ? {
        popularityScore: latestRaw.popularityScore,
        heatScore: latestRaw.heatScore,
        sentimentScore: latestRaw.sentimentScore,
        controversyScore: latestRaw.controversyScore,
        coverageScore: latestRaw.coverageScore,
        confidenceScore: latestRaw.confidenceScore,
        calculatedAt: latestRaw.calculatedAt,
        explanationJson: latestRaw.explanationJson as ScoreExplanation,
      }
    : null;

  return {
    person: {
      id: person.id,
      wikidataQid: person.wikidataQid,
      displayName: person.displayName,
      occupationSummary: person.occupationSummary,
      photoUrl: person.photoUrl ?? null,
    },
    latestScore,
    scoreHistory: allScores.map(s => ({
      calculatedAt: s.calculatedAt,
      popularityScore: s.popularityScore,
      heatScore: s.heatScore,
    })),
  };
}

export interface RawPersonObservations {
  pageviews: Array<{ date: string; views: number }>;
  sourceObs: Array<{ metricType: string; metricValue: number }>;
}

export async function getPersonRawObservations(personId: number): Promise<RawPersonObservations> {
  const conn = await db();
  if (!conn) return { pageviews: [], sourceObs: [] };

  const [pvRows, obsRows] = await Promise.all([
    conn
      .select({ date: pageviewObservations.date, views: pageviewObservations.views })
      .from(pageviewObservations)
      .where(eq(pageviewObservations.personId, personId))
      .orderBy(desc(pageviewObservations.date))
      .limit(90),
    conn
      .select({ metricType: sourceObservations.metricType, metricValue: sourceObservations.metricValue })
      .from(sourceObservations)
      .where(eq(sourceObservations.personId, personId)),
  ]);

  return { pageviews: pvRows, sourceObs: obsRows };
}

export async function searchPeople(query: string) {
  if (!query || query.trim().length < 2) return [];
  const conn = await db();
  if (!conn) return [];

  const normalized = query.toLowerCase().trim();
  const rows = await conn
    .selectDistinct({
      person: {
        id: people.id,
        wikidataQid: people.wikidataQid,
        displayName: people.displayName,
        occupationSummary: people.occupationSummary,
      },
    })
    .from(people)
    .leftJoin(personAliases, eq(personAliases.personId, people.id))
    .where(
      or(
        ilike(people.normalizedName, `%${normalized}%`),
        ilike(people.displayName, `%${normalized}%`),
        ilike(personAliases.alias, `%${normalized}%`),
      ),
    )
    .limit(50);

  return rows.map(r => r.person);
}

// Browse ALL people (not just scored) — for the /browse page
export async function browsePeople(
  offset = 0,
  limit = 60,
  query?: string,
): Promise<{ items: BrowsePerson[]; total: number }> {
  const conn = await db();
  if (!conn) return { items: [], total: 0 };

  const whereClause = query
    ? or(
        ilike(people.displayName, `%${query.toLowerCase()}%`),
        ilike(people.normalizedName, `%${query.toLowerCase()}%`),
      )
    : undefined;

  const [rows, countRows] = await Promise.all([
    conn
      .select({
        id: people.id,
        wikidataQid: people.wikidataQid,
        displayName: people.displayName,
        occupationSummary: people.occupationSummary,
      })
      .from(people)
      .where(whereClause)
      .orderBy(asc(people.displayName))
      .limit(limit)
      .offset(offset),
    conn
      .select({ total: count() })
      .from(people)
      .where(whereClause),
  ]);

  return {
    items: rows,
    total: Number(countRows[0]?.total ?? 0),
  };
}

// Reads pre-computed news feed from DB cache.
// Worker updates this every 15 minutes via `pnpm update:trending`.
export async function getNewsFeed(): Promise<FeedArticle[]> {
  const conn = await db();
  if (!conn) return [];

  const rows = await conn
    .select({ data: cacheEntries.data })
    .from(cacheEntries)
    .where(eq(cacheEntries.key, 'news_feed'))
    .limit(1);

  if (!rows[0]) return [];
  return rows[0].data as FeedArticle[];
}

// Reads pre-computed trending data from DB cache — zero GDELT calls at render time.
// Worker updates this every 15 minutes via `pnpm update:trending`.
// Cap trending at 100 entries.
export async function getTrendingLeaderboard(
  timespan: '1h' | '24h' | '30d',
  limit = 100,
): Promise<TrendingEntry[]> {
  const conn = await db();
  if (!conn) return [];

  const rows = await conn
    .select({ data: cacheEntries.data })
    .from(cacheEntries)
    .where(eq(cacheEntries.key, `trending:${timespan}`))
    .limit(1);

  if (!rows[0]) return [];
  const data = rows[0].data as TrendingEntry[];
  return data.slice(0, limit);
}

export async function getPersonTopArticles(displayName: string, maxRecords = 5): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    query: `"${displayName}"`,
    mode: 'artlist',
    maxrecords: String(maxRecords),
    format: 'json',
    timespan: '10080', // 7 days in minutes
    sort: 'DateDesc',
  });
  const WIKIMEDIA_UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      // 5-min cache: prevents hammering GDELT on every page hit while not
      // locking in a rate-limit response for a full hour.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.startsWith('{') && !text.startsWith('[')) return [];
    const data = JSON.parse(text) as { articles?: NewsArticle[] };
    return data.articles?.slice(0, maxRecords) ?? [];
  } catch {
    return [];
  }
}

export interface TrendingReason {
  articleCount: number;
  timespan: string;
  bullets: string[];
  articles: NewsArticle[];
}

// Fetch a "why trending / in the news" summary for a person.
// Priority: trending cache (1h/24h/30d) → news_by_person cache → live GDELT fallback.
// All four cache keys are fetched in a single DB round trip.
export async function getPersonTrendingReason(
  displayName: string,
  wikidataQid: string,
): Promise<TrendingReason | null> {
  const conn = await db();
  if (!conn) return null;

  // Single DB query for all 4 cache keys
  const CACHE_KEYS = ['trending:1h', 'trending:24h', 'trending:30d', 'news_by_person'] as const;
  const rows = await conn
    .select({ key: cacheEntries.key, data: cacheEntries.data })
    .from(cacheEntries)
    .where(inArray(cacheEntries.key, [...CACHE_KEYS]));

  const byKey = Object.fromEntries(rows.map(r => [r.key, r.data]));

  // 1. Check trending caches — person is in top-50 trending
  for (const [timespan, label] of [['1h', 'last hour'], ['24h', 'last 24 hours'], ['30d', 'last 14 days']] as const) {
    const cached = byKey[`trending:${timespan}`] as Array<{
      wikidataQid: string;
      articleCount: number;
      trendingArticles?: NewsArticle[];
    }> | undefined;
    const entry = cached?.find(e => e.wikidataQid === wikidataQid);
    if (entry?.trendingArticles && entry.trendingArticles.length > 0) {
      return {
        articleCount: entry.articleCount,
        timespan: label,
        bullets: buildBullets(entry.articleCount, label, entry.trendingArticles),
        articles: entry.trendingArticles,
      };
    }
  }

  // 2. Check news_by_person cache — covers all scored people with any article mentions
  const newsByPerson = byKey['news_by_person'] as Record<string, NewsArticle[]> | undefined;
  const personArticles = newsByPerson?.[wikidataQid];
  if (personArticles && personArticles.length > 0) {
    return {
      articleCount: personArticles.length,
      timespan: 'last 14 days',
      bullets: buildBullets(personArticles.length, 'last 14 days', personArticles),
      articles: personArticles,
    };
  }

  // 3. Live GDELT fallback — capped at 3s so it never blocks the page
  if (!displayName) return null;
  const articles = await getPersonTopArticles(displayName, 5);
  if (articles.length === 0) return null;

  return {
    articleCount: articles.length,
    timespan: 'last 7 days',
    bullets: buildBullets(articles.length, 'last 7 days', articles),
    articles,
  };
}

// ─── Categories ──────────────────────────────────────────────────────────────

export interface CategoryStat {
  slug: string;       // URL-safe version (e.g. "politician")
  label: string;      // display version (e.g. "Politician")
  count: number;      // total people in DB with this occupation
  scoredCount: number; // people who also have a score snapshot
}

export async function getCategories(): Promise<CategoryStat[]> {
  const conn = await db();
  if (!conn) return [];

  // Count all people per occupation
  const allRows = await conn
    .select({ occ: people.occupationSummary, total: count() })
    .from(people)
    .where(sql`${people.occupationSummary} is not null`)
    .groupBy(people.occupationSummary)
    .orderBy(desc(sql`count(*)`));

  // Count scored people per occupation (need a join)
  const latestScores = conn
    .select({ personId: scoreSnapshots.personId })
    .from(scoreSnapshots)
    .groupBy(scoreSnapshots.personId)
    .as('has_score');

  const scoredRows = await conn
    .select({ occ: people.occupationSummary, total: count() })
    .from(people)
    .innerJoin(latestScores, eq(latestScores.personId, people.id))
    .where(sql`${people.occupationSummary} is not null`)
    .groupBy(people.occupationSummary);

  const scoredMap = new Map(scoredRows.map(r => [r.occ, Number(r.total)]));

  return allRows
    .filter(r => r.occ && Number(r.total) >= 2)
    .map(r => ({
      slug: r.occ!.toLowerCase().replace(/\s+/g, '-'),
      label: r.occ!.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      count: Number(r.total),
      scoredCount: scoredMap.get(r.occ!) ?? 0,
    }))
    .sort((a, b) => b.scoredCount - a.scoredCount || b.count - a.count);
}

export async function getPeopleByCategory(
  occupationSlug: string,
  limit = 100,
): Promise<LeaderboardEntry[]> {
  const conn = await db();
  if (!conn) return [];

  // Convert slug back to a pattern for the DB (stored with underscores or spaces)
  const pattern = occupationSlug.replace(/-/g, '_');

  const { latestScores } = buildLeaderboardBase(conn, 'popularity');

  const rows = await conn
    .select({
      person: {
        id: people.id,
        wikidataQid: people.wikidataQid,
        displayName: people.displayName,
        occupationSummary: people.occupationSummary,
        photoUrl: people.photoUrl,
      },
      score: scoreSnapshots,
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
    .where(ilike(people.occupationSummary, `%${pattern}%`))
    .orderBy(desc(scoreSnapshots.popularityScore))
    .limit(limit);

  return rows.map((r, i) => ({
    rank: i + 1,
    wikidataQid: r.person.wikidataQid,
    displayName: r.person.displayName,
    occupationSummary: r.person.occupationSummary,
    photoUrl: r.person.photoUrl,
    popularityScore: r.score.popularityScore,
    heatScore: r.score.heatScore,
    coverageScore: r.score.coverageScore,
    coverageLabel: (r.score.explanationJson as { coverage_label?: string } | null)?.coverage_label ?? 'Partial coverage',
    scoreModelVersion: r.score.scoreModelVersion,
    calculatedAt: r.score.calculatedAt,
  }));
}

// ─── Rising stars / biggest movers ───────────────────────────────────────────

export interface MoverEntry {
  wikidataQid: string;
  displayName: string;
  occupationSummary: string | null;
  photoUrl: string | null;
  currentScore: number;
  previousScore: number;
  delta: number;           // currentScore - previousScore
  deltaPercent: number;    // percentage change
}

export async function getMovers(
  metric: 'popularity' | 'heat' = 'popularity',
  windowHours = 48,
  limit = 10,
): Promise<{ rising: MoverEntry[]; falling: MoverEntry[] }> {
  const conn = await db();
  if (!conn) return { rising: [], falling: [] };

  const cutoff = new Date(Date.now() - windowHours * 3_600_000);
  const col = metric === 'heat' ? 'heat_score' : 'popularity_score';

  // Raw SQL to avoid complex Drizzle join gymnastics:
  // For each person get their latest score + their score at/after the window cutoff
  const rows = await conn.execute(sql`
    SELECT
      p.wikidata_qid,
      p.display_name,
      p.occupation_summary,
      p.photo_url,
      cur.${sql.raw(col)}   AS current_score,
      prev.${sql.raw(col)}  AS previous_score
    FROM people p
    JOIN score_snapshots cur  ON cur.person_id = p.id
      AND cur.calculated_at = (
        SELECT max(s2.calculated_at) FROM score_snapshots s2 WHERE s2.person_id = p.id
      )
    JOIN score_snapshots prev ON prev.person_id = p.id
      AND prev.calculated_at = (
        SELECT min(s3.calculated_at) FROM score_snapshots s3
        WHERE s3.person_id = p.id AND s3.calculated_at >= ${cutoff}
      )
    WHERE cur.${sql.raw(col)} <> prev.${sql.raw(col)}
  `);

  const movers: MoverEntry[] = (rows as unknown as Array<{
    wikidata_qid: string;
    display_name: string;
    occupation_summary: string | null;
    photo_url: string | null;
    current_score: number;
    previous_score: number;
  }>).map(r => {
    const delta = r.current_score - r.previous_score;
    return {
      wikidataQid: r.wikidata_qid,
      displayName: r.display_name,
      occupationSummary: r.occupation_summary,
      photoUrl: r.photo_url,
      currentScore: r.current_score,
      previousScore: r.previous_score,
      delta,
      deltaPercent: r.previous_score > 0 ? (delta / r.previous_score) * 100 : 0,
    };
  }).filter(m => Math.abs(m.delta) >= 1);

  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    rising: movers.filter(m => m.delta > 0).slice(0, limit),
    falling: movers.filter(m => m.delta < 0).slice(0, limit),
  };
}

// ─── Compare two people ───────────────────────────────────────────────────────

export async function getComparisonData(qidA: string, qidB: string) {
  const [a, b] = await Promise.all([
    getPersonWithScores(qidA),
    getPersonWithScores(qidB),
  ]);
  return { a, b };
}

function buildBullets(count: number, timespan: string, articles: NewsArticle[]): string[] {
  const bullets: string[] = [];
  bullets.push(`Mentioned in ${count} news article${count !== 1 ? 's' : ''} in the ${timespan}`);

  const domains = [...new Set(articles.map(a => a.domain))].slice(0, 3);
  if (domains.length > 0) {
    bullets.push(`Covered by: ${domains.join(', ')}`);
  }

  // Add article title previews (up to 3, truncated at 80 chars)
  for (const article of articles.slice(0, 3)) {
    const title = article.title.length > 80 ? article.title.slice(0, 77) + '…' : article.title;
    bullets.push(title);
  }

  return bullets;
}
