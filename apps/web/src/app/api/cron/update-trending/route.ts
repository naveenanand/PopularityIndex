/**
 * Reverse-lookup trending: fetch GDELT articles first, match against DB.
 * 1 GDELT call per timespan (vs. 50+ in the old approach) — works across all 100k people.
 */
import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { people, scoreSnapshots, cacheEntries } from '@pai/db';
import { db } from '../../../../lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

const GDELT_TIMESPANS: Record<string, string> = {
  '1h':  '60',
  '24h': '1440',
  '30d': '43200',
};

interface GDELTArticle {
  title: string;
  url: string;
  domain: string;
  seendate: string;
}

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
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: GDELTArticle[] };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conn = await db();
  if (!conn) return NextResponse.json({ error: 'No DB' }, { status: 500 });

  const results: Record<string, number> = {};

  for (const [timespan, gdeltMinutes] of Object.entries(GDELT_TIMESPANS)) {
    const articles = await fetchGDELTArticles(gdeltMinutes);
    if (articles.length === 0) {
      results[timespan] = 0;
      continue;
    }

    // Concatenate all article titles — PostgreSQL will search this corpus
    const corpus = articles.map(a => a.title).join(' § ');

    // Match people whose full display name (>=8 chars to avoid false positives) appears in the corpus
    const rows = await conn.execute(sql`
      SELECT
        p.id,
        p.wikidata_qid,
        p.display_name,
        p.photo_url,
        p.occupation_summary,
        COALESCE(ss.popularity_score, 0)       AS popularity_score,
        COALESCE(ss.heat_score, 0)             AS heat_score,
        COALESCE(ss.coverage_score, 0)         AS coverage_score,
        COALESCE(ss.score_model_version, 'v1') AS score_model_version,
        COALESCE(ss.calculated_at, NOW())      AS calculated_at
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

    type Row = Record<string, unknown>;
    const trending: Array<{
      rank: number;
      wikidataQid: string;
      displayName: string;
      photoUrl: string | null;
      occupationSummary: string | null;
      popularityScore: number;
      heatScore: number;
      coverageScore: number;
      coverageLabel: string;
      scoreModelVersion: string;
      calculatedAt: Date;
      articleCount: number;
      trendingArticles: GDELTArticle[];
    }> = [];

    for (const row of rows as unknown as Row[]) {
      const name = String(row['display_name']).toLowerCase();
      const matched = articles.filter(a => a.title.toLowerCase().includes(name));
      if (matched.length === 0) continue;
      trending.push({
        rank:               0,
        wikidataQid:        String(row['wikidata_qid']),
        displayName:        String(row['display_name']),
        photoUrl:           row['photo_url'] ? String(row['photo_url']) : null,
        occupationSummary:  row['occupation_summary'] ? String(row['occupation_summary']) : null,
        popularityScore:    Number(row['popularity_score']),
        heatScore:          Number(row['heat_score']),
        coverageScore:      Number(row['coverage_score']),
        coverageLabel:      'Partial coverage',
        scoreModelVersion:  String(row['score_model_version']),
        calculatedAt:       new Date(String(row['calculated_at'])),
        articleCount:       matched.length,
        trendingArticles:   matched.slice(0, 5),
      });
    }

    const sorted = trending
      .sort((a, b) => b.articleCount - a.articleCount)
      .slice(0, 50)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    await conn
      .insert(cacheEntries)
      .values({ key: `trending:${timespan}`, data: sorted, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: cacheEntries.key,
        set: { data: sorted, updatedAt: new Date() },
      });

    results[timespan] = sorted.length;
  }

  // News feed — use the 24h article batch to build a feed linked to top scored people
  const latestScores = conn
    .select({
      personId: scoreSnapshots.personId,
      maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
    })
    .from(scoreSnapshots)
    .groupBy(scoreSnapshots.personId)
    .as('latest_scores');

  const topPeople = await conn
    .select({ wikidataQid: people.wikidataQid, displayName: people.displayName })
    .from(people)
    .innerJoin(latestScores, eq(latestScores.personId, people.id))
    .limit(50);

  const feedArticles = await fetchGDELTArticles('1440', 50);
  const feed = feedArticles.slice(0, 20).map(a => {
    const matched = topPeople.find(p =>
      a.title.toLowerCase().includes(p.displayName.toLowerCase().split(' ')[0] ?? ''),
    ) ?? topPeople[0];
    return {
      title: a.title,
      url: a.url,
      domain: a.domain,
      seendate: a.seendate,
      personName: matched?.displayName ?? '',
      personQid: matched?.wikidataQid ?? '',
    };
  });

  await conn
    .insert(cacheEntries)
    .values({ key: 'news_feed', data: feed, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { data: feed, updatedAt: new Date() },
    });

  return NextResponse.json({
    ok: true,
    trending: results,
    newsFeed: feed.length,
    updatedAt: new Date().toISOString(),
  });
}
