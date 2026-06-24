import { eq, desc, asc, ilike, or, and, sql, count } from 'drizzle-orm';
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
    timespan: '10080', // 7d in minutes
    sort: 'DateDesc',
  });
  const WIKIMEDIA_UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: NewsArticle[] };
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

// Fetch GDELT articles for a person and build a "why trending" summary.
// Uses cached trending article data when available, falls back to live GDELT.
export async function getPersonTrendingReason(
  displayName: string,
  wikidataQid: string,
): Promise<TrendingReason | null> {
  const conn = await db();

  // Check all trending caches for pre-fetched articles stored during update:trending
  if (conn) {
    for (const timespan of ['1h', '24h', '30d'] as const) {
      const rows = await conn
        .select({ data: cacheEntries.data })
        .from(cacheEntries)
        .where(eq(cacheEntries.key, `trending:${timespan}`))
        .limit(1);
      if (!rows[0]) continue;

      const cached = rows[0].data as Array<{
        wikidataQid: string;
        articleCount: number;
        trendingArticles?: NewsArticle[];
      }>;
      const entry = cached.find(e => e.wikidataQid === wikidataQid);
      if (entry && entry.trendingArticles && entry.trendingArticles.length > 0) {
        const timespanLabel = timespan === '1h' ? 'last hour' : timespan === '24h' ? 'last 24 hours' : 'last 30 days';
        return {
          articleCount: entry.articleCount,
          timespan: timespanLabel,
          bullets: buildBullets(entry.articleCount, timespanLabel, entry.trendingArticles),
          articles: entry.trendingArticles,
        };
      }
    }
  }

  // Fall back to a live GDELT query
  const articles = await getPersonTopArticles(displayName, 5);
  if (articles.length === 0) return null;

  return {
    articleCount: articles.length,
    timespan: 'last 7 days',
    bullets: buildBullets(articles.length, 'last 7 days', articles),
    articles,
  };
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
