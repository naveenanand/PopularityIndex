import { NextResponse } from 'next/server';
import { eq, desc, and, sql } from 'drizzle-orm';
import { people, scoreSnapshots, cacheEntries } from '@pai/db';
import { db } from '../../../../lib/db';
import type { FeedArticle, TrendingEntry } from '../../../../lib/api';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

const GDELT_TIMESPANS: Record<string, string> = {
  '1h': '60',
  '24h': '1440',
  '30d': '43200',
};

async function fetchGDELTCount(name: string, gdeltMinutes: string): Promise<number> {
  const params = new URLSearchParams({
    query: `"${name}"`, mode: 'artlist', maxrecords: '75',
    format: 'json', timespan: gdeltMinutes, sort: 'DateDesc',
  });
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { articles?: unknown[] };
    return data.articles?.length ?? 0;
  } catch {
    return 0;
  }
}

export async function GET(request: Request) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conn = await db();
  if (!conn) return NextResponse.json({ error: 'No DB' }, { status: 500 });

  const latestScores = conn
    .select({
      personId: scoreSnapshots.personId,
      maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
    })
    .from(scoreSnapshots)
    .groupBy(scoreSnapshots.personId)
    .as('latest_scores');

  const topPeople = await conn
    .select({
      wikidataQid: people.wikidataQid,
      displayName: people.displayName,
      occupationSummary: people.occupationSummary,
      photoUrl: people.photoUrl,
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
    .limit(50);

  if (topPeople.length === 0) {
    return NextResponse.json({ ok: true, message: 'No scored people — skipped' });
  }

  const results: Record<string, number> = {};

  for (const [timespan, gdeltMinutes] of Object.entries(GDELT_TIMESPANS)) {
    const counts = await Promise.all(
      topPeople.map(p =>
        fetchGDELTCount(p.displayName, gdeltMinutes).then(n => ({ qid: p.wikidataQid, n })),
      ),
    );
    const countMap = new Map(counts.map(r => [r.qid, r.n]));

    const entries: TrendingEntry[] = topPeople
      .map(p => ({
        rank: 0,
        wikidataQid: p.wikidataQid,
        displayName: p.displayName,
        occupationSummary: p.occupationSummary,
        photoUrl: p.photoUrl,
        popularityScore: p.popularityScore,
        heatScore: p.heatScore,
        coverageScore: p.coverageScore,
        coverageLabel: 'Partial coverage',
        scoreModelVersion: p.scoreModelVersion,
        calculatedAt: p.calculatedAt,
        articleCount: countMap.get(p.wikidataQid) ?? 0,
      }))
      .filter(e => e.articleCount > 0)
      .sort((a, b) => b.articleCount - a.articleCount)
      .slice(0, 100)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    await conn
      .insert(cacheEntries)
      .values({ key: `trending:${timespan}`, data: entries, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: cacheEntries.key,
        set: { data: entries, updatedAt: new Date() },
      });

    results[timespan] = entries.length;
  }

  // Update news feed
  const topNames = topPeople.slice(0, 8).map(p => p.displayName);
  const orQuery = topNames.map(n => `"${n}"`).join(' OR ');
  const newsParams = new URLSearchParams({
    query: orQuery, mode: 'artlist', maxrecords: '20',
    format: 'json', timespan: '1440', sort: 'DateDesc',
  });

  let feedArticles: FeedArticle[] = [];
  try {
    const newsRes = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${newsParams}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (newsRes.ok) {
      const newsData = (await newsRes.json()) as {
        articles?: Array<{ title: string; url: string; domain: string; seendate: string }>;
      };
      feedArticles = (newsData.articles ?? []).map(a => {
        const matched =
          topPeople.find(p =>
            a.title.toLowerCase().includes(p.displayName.toLowerCase().split(' ')[0] ?? ''),
          ) ?? topPeople[0]!;
        return {
          title: a.title,
          url: a.url,
          domain: a.domain,
          seendate: a.seendate,
          personName: matched.displayName,
          personQid: matched.wikidataQid,
        };
      });
    }
  } catch {
    // News feed failure is non-fatal
  }

  await conn
    .insert(cacheEntries)
    .values({ key: 'news_feed', data: feedArticles, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { data: feedArticles, updatedAt: new Date() },
    });

  return NextResponse.json({
    ok: true,
    trending: results,
    newsFeed: feedArticles.length,
    updatedAt: new Date().toISOString(),
  });
}
