import { eq, desc, asc, ilike, or, and, sql, count } from 'drizzle-orm';
import { people, personAliases, scoreSnapshots, pageviewObservations, sourceObservations } from '@pai/db';
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

const WIKIMEDIA_UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

// Fetch a Wikipedia thumbnail — cached by Next.js for 24 hours (no repeat API calls)
export async function getPersonPhoto(displayName: string): Promise<string | null> {
  const title = encodeURIComponent(displayName.replace(/ /g, '_'));
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail?: { source: string } };
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
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

export async function getLeaderboard(
  sortBy: 'popularity' | 'heat' = 'popularity',
  limit = 100,
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

  // Fetch photos in parallel — Next.js data cache means this only hits Wikipedia once per 24h
  const photoResults = await Promise.allSettled(
    rows.map(row => getPersonPhoto(row.person.displayName)),
  );

  return rows.map((row, idx) => {
    const explanation = row.score.explanationJson as ScoreExplanation;
    const pr = photoResults[idx];
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
      photoUrl: pr?.status === 'fulfilled' ? (pr.value ?? null) : null,
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

// Browse ALL people (not just scored) — for the /browse page with millions of records
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

// News feed: one GDELT OR-query across top people, cached 1 hour
export async function getNewsFeed(): Promise<FeedArticle[]> {
  const conn = await db();
  if (!conn) return [];

  const latestScores = conn
    .select({
      personId: scoreSnapshots.personId,
      maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
    })
    .from(scoreSnapshots)
    .groupBy(scoreSnapshots.personId)
    .as('ls');

  const top = await conn
    .select({
      wikidataQid: people.wikidataQid,
      displayName: people.displayName,
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
    .limit(8);

  if (top.length === 0) return [];

  const orQuery = top.map(p => `"${p.displayName}"`).join(' OR ');
  const params = new URLSearchParams({
    query: orQuery,
    mode: 'artlist',
    maxrecords: '20',
    format: 'json',
    timespan: '1440', // 24h in minutes
    sort: 'DateDesc',
  });

  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      next: { revalidate: 3600 }, // Cache feed for 1 hour
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      articles?: Array<{ title: string; url: string; domain: string; seendate: string }>;
    };
    const articles = data.articles ?? [];

    return articles.map(a => {
      // Match article back to the person whose name appears in the title
      const matched = top.find(p =>
        a.title.toLowerCase().includes(p.displayName.toLowerCase().split(' ')[0] ?? ''),
      ) ?? top[0]!;
      return {
        title: a.title,
        url: a.url,
        domain: a.domain,
        seendate: a.seendate,
        personName: matched.displayName,
        personQid: matched.wikidataQid,
      };
    });
  } catch {
    return [];
  }
}

const GDELT_TIMESPAN: Record<string, string> = {
  '1h': '60',
  '24h': '1440',
  '30d': '43200',
};

async function fetchGDELTCount(name: string, timespan: string): Promise<number> {
  const gdeltTimespan = GDELT_TIMESPAN[timespan] ?? timespan;
  const params = new URLSearchParams({
    query: `"${name}"`, mode: 'artlist', maxrecords: '75',
    format: 'json', timespan: gdeltTimespan, sort: 'DateDesc',
  });
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { articles?: unknown[] };
    return data.articles?.length ?? 0;
  } catch {
    return 0;
  }
}

export async function getTrendingLeaderboard(
  timespan: '1h' | '24h' | '30d',
  limit = 50,
): Promise<TrendingEntry[]> {
  const conn = await db();
  if (!conn) return [];

  const { latestScores } = buildLeaderboardBase(conn, 'popularity');

  const rows = await conn
    .select({
      person: {
        id: people.id,
        wikidataQid: people.wikidataQid,
        displayName: people.displayName,
        occupationSummary: people.occupationSummary,
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
    .orderBy(desc(scoreSnapshots.popularityScore))
    .limit(200);

  if (rows.length === 0) return [];

  const base: LeaderboardEntry[] = rows.slice(0, 10).map((row, idx) => {
    const explanation = row.score.explanationJson as ScoreExplanation;
    return {
      rank: idx + 1,
      wikidataQid: row.person.wikidataQid,
      displayName: row.person.displayName,
      occupationSummary: row.person.occupationSummary,
      popularityScore: row.score.popularityScore,
      heatScore: row.score.heatScore,
      coverageScore: row.score.coverageScore,
      coverageLabel: explanation?.coverage_label ?? 'Partial coverage',
      scoreModelVersion: row.score.scoreModelVersion,
      calculatedAt: row.score.calculatedAt,
      photoUrl: null as string | null,
    };
  });

  const results = await Promise.all(
    base.map(e => fetchGDELTCount(e.displayName, timespan).then(n => ({ qid: e.wikidataQid, n }))),
  );
  const counts = new Map(results.map(r => [r.qid, r.n]));

  return base
    .map(e => ({ ...e, articleCount: counts.get(e.wikidataQid) ?? 0 }))
    .sort((a, b) => b.articleCount - a.articleCount)
    .slice(0, limit);
}

export async function getPersonTopArticles(displayName: string): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    query: `"${displayName}"`,
    mode: 'artlist',
    maxrecords: '3',
    format: 'json',
    timespan: '10080', // 7d in minutes
    sort: 'DateDesc',
  });
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: NewsArticle[] };
    return data.articles?.slice(0, 3) ?? [];
  } catch {
    return [];
  }
}
