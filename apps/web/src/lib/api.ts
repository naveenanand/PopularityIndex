import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';
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

export async function getLeaderboard(
  sortBy: 'popularity' | 'heat' = 'popularity',
  limit = 100,
): Promise<LeaderboardEntry[]> {
  const conn = await db();
  if (!conn) return [];

  const sortCol = sortBy === 'heat' ? scoreSnapshots.heatScore : scoreSnapshots.popularityScore;

  const latestScores = conn
    .select({
      personId: scoreSnapshots.personId,
      maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
    })
    .from(scoreSnapshots)
    .groupBy(scoreSnapshots.personId)
    .as('latest_scores');

  const rows = await conn
    .select({
      person: people,
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
    .limit(limit);

  const entries = rows.map((row, idx) => {
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

  const photos = await Promise.all(entries.map((e) => getPersonPhoto(e.displayName)));
  entries.forEach((e, i) => { e.photoUrl = photos[i] ?? null; });

  return entries;
}

export async function getPersonWithScores(wikidataQid: string): Promise<PersonWithScores | null> {
  const conn = await db();
  if (!conn) return null;

  const personRows = await conn
    .select()
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

  const scoreHistory = allScores.map((s) => ({
    calculatedAt: s.calculatedAt,
    popularityScore: s.popularityScore,
    heatScore: s.heatScore,
  }));

  return {
    person: {
      id: person.id,
      wikidataQid: person.wikidataQid,
      displayName: person.displayName,
      occupationSummary: person.occupationSummary,
    },
    latestScore,
    scoreHistory,
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

  return {
    pageviews: pvRows,
    sourceObs: obsRows,
  };
}

export async function searchPeople(query: string) {
  if (!query || query.trim().length < 2) return [];

  const conn = await db();
  if (!conn) return [];

  const normalized = query.toLowerCase().trim();

  const rows = await conn
    .selectDistinct({ person: people })
    .from(people)
    .leftJoin(personAliases, eq(personAliases.personId, people.id))
    .where(
      or(
        ilike(people.normalizedName, `%${normalized}%`),
        ilike(people.displayName, `%${normalized}%`),
        ilike(personAliases.alias, `%${normalized}%`),
      ),
    )
    .limit(20);

  return rows.map((r) => r.person);
}

const WIKIMEDIA_UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

export async function getPersonPhoto(displayName: string): Promise<string | null> {
  const title = encodeURIComponent(displayName.replace(/ /g, '_'));
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail?: { source: string } };
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
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

async function fetchGDELTCount(name: string, timespan: string): Promise<number> {
  const params = new URLSearchParams({
    query: `"${name}"`, mode: 'artlist', maxrecords: '50',
    format: 'json', timespan, sort: 'DateDesc',
  });
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      signal: AbortSignal.timeout(8_000),
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
  // Pull top 200 by popularity from DB (most likely to actually trend)
  const base = await getLeaderboard('popularity', 200);
  if (base.length === 0) return [];

  // Fetch GDELT counts in batches of 8 to stay within timeout budgets
  const BATCH = 8;
  const counts = new Map<string, number>();
  for (let i = 0; i < base.length; i += BATCH) {
    const batch = base.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(e => fetchGDELTCount(e.displayName, timespan).then(n => ({ qid: e.wikidataQid, n }))),
    );
    results.forEach(r => counts.set(r.qid, r.n));
  }

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
    timespan: '7d',
    sort: 'DateDesc',
  });
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: NewsArticle[] };
    return data.articles?.slice(0, 3) ?? [];
  } catch {
    return [];
  }
}
