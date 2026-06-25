/**
 * Trending cron — batch name approach:
 *
 * Fetches top 100 scored people, batches their names into OR queries (20/batch),
 * runs 5 concurrent GDELT calls per timespan (fine on Vercel's clean IPs),
 * deduplicates articles, counts per person in JS, stores top 50 in cache.
 *
 * Also runs a broad "discovery" query to catch newsworthy unscored people.
 */
import { NextResponse } from 'next/server';
import { desc, eq, and, sql } from 'drizzle-orm';
import { people, scoreSnapshots, cacheEntries } from '@pai/db';
import { db } from '../../../../lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

// GDELT artlist timespan in minutes (artlist only accepts integers)
const GDELT_TIMESPANS: Record<string, string> = {
  '1h':  '60',
  '24h': '1440',
  '30d': '20160', // 14 days — 30d (43200) can hit query-complexity limits with long OR chains
};

const DISCOVERY_QUERY =
  '(president OR minister OR senator OR CEO OR actor OR singer OR athlete OR champion OR arrested OR elected OR appointed)';

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

async function fetchGDELT(query: string, gdeltMinutes: string): Promise<GDELTArticle[]> {
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
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text.startsWith('{') && !text.startsWith('[')) return [];
    const data = JSON.parse(text) as { articles?: GDELTArticle[] };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

function dedupe(arts: GDELTArticle[]): GDELTArticle[] {
  return [...new Map(arts.map(a => [a.url, a])).values()];
}

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const conn = await db();
  if (!conn) return NextResponse.json({ error: 'No DB' }, { status: 500 });

  // Get top 100 scored people (most likely to be in news)
  const latestScores = conn
    .select({
      personId: scoreSnapshots.personId,
      maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
    })
    .from(scoreSnapshots)
    .groupBy(scoreSnapshots.personId)
    .as('latest_scores');

  const scoredPeople: ScoredPerson[] = await conn
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
    .limit(200);

  if (scoredPeople.length === 0) {
    return NextResponse.json({ ok: true, message: 'No scored people — skipped' });
  }

  const results: Record<string, number> = {};

  // 10 names per batch: GDELT rejects OR queries over ~300 chars and requires
  // parentheses around OR chains. 10 × ~20 chars/name ≈ 270 chars — safely under limit.
  // 200 people / 10 per batch = 20 batches × 3 timespans + discovery + feed ≈ 65 calls.
  // At 2s delay each: ~130s sequential — within maxDuration=300.
  const BATCH = 10;
  const nameBatches: string[] = [];
  for (let i = 0; i < scoredPeople.length; i += BATCH) {
    nameBatches.push(
      `(${scoredPeople.slice(i, i + BATCH).map(p => `"${p.displayName}"`).join(' OR ')})`,
    );
  }

  // Per-person news map: accumulated across all timespans, used to populate person pages
  // Key: wikidataQid, Value: deduped articles (most recent timespan wins)
  const personNewsMap = new Map<string, GDELTArticle[]>();

  for (const [timespan, gdeltMinutes] of Object.entries(GDELT_TIMESPANS)) {
    // Run batches sequentially with 2s gaps — concurrent calls from the same
    // Vercel function share one IP and reliably trigger GDELT's rate limit.
    const batchArticles: GDELTArticle[][] = [];
    for (const q of nameBatches) {
      batchArticles.push(await fetchGDELT(q, gdeltMinutes));
      await delay(2000);
    }
    const discoveryArticles = await fetchGDELT(DISCOVERY_QUERY, gdeltMinutes);
    const batchResults = [...batchArticles, discoveryArticles];

    const unique = dedupe(batchResults.flat());

    // Count per scored person (title matching in JS)
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

    // Accumulate into per-person news map (dedup by URL)
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

    const trending = scoredPeople
      .filter(p => {
        const articles = countMap.get(p.wikidataQid);
        // Require at least 2 article mentions to filter out coincidental substring matches
        return (articles?.length ?? 0) >= 2;
      })
      .map(p => {
        const articles = countMap.get(p.wikidataQid)!;
        // Hybrid rank: article count × (1 + log of popularity score) so
        // someone with many articles AND a real score outranks a zero-scored newcomer
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

    await conn
      .insert(cacheEntries)
      .values({ key: `trending:${timespan}`, data: trending, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: cacheEntries.key,
        set: { data: trending, updatedAt: new Date() },
      });

    results[timespan] = trending.length;
  }

  // Store per-person news cache — used by person detail pages to show
  // "Why They're Trending / In the News" without calling GDELT live on every visit.
  // Covers ALL scored people who have any article mentions, not just trending top-50.
  const newsByPerson: Record<string, GDELTArticle[]> = {};
  for (const [qid, articles] of personNewsMap) {
    newsByPerson[qid] = articles
      .sort((a, b) => b.seendate.localeCompare(a.seendate))
      .slice(0, 5);
  }
  await conn
    .insert(cacheEntries)
    .values({ key: 'news_by_person', data: newsByPerson, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { data: newsByPerson, updatedAt: new Date() },
    });

  // News feed: concurrent fetch for top 8 people names
  const top8Query = `(${scoredPeople.slice(0, 8).map(p => `"${p.displayName}"`).join(' OR ')})`;
  const feedArticles = await fetchGDELT(top8Query, '1440');
  const feed = feedArticles.slice(0, 20).map(a => {
    const tl = a.title.toLowerCase();
    const matched = scoredPeople.find(p => tl.includes(p.displayName.toLowerCase())) ?? scoredPeople[0]!;
    return {
      title:      a.title,
      url:        a.url,
      domain:     a.domain,
      seendate:   a.seendate,
      personName: matched.displayName,
      personQid:  matched.wikidataQid,
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
    newsByPerson: Object.keys(newsByPerson).length,
    updatedAt: new Date().toISOString(),
  });
}
