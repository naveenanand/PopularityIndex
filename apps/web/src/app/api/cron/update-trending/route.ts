/**
 * Trending cron — hybrid approach:
 *
 * trending:1h  → Google News RSS, articles published in the last 75 minutes.
 *                Queried per-person so the ranking is purely "who is in the
 *                news RIGHT NOW" — changes every cron run.
 *
 * trending:24h → GDELT news articles for last 24h, mild popularity tiebreak.
 * trending:30d → GDELT news articles for last 14 days, mild popularity tiebreak.
 */
import { NextResponse } from 'next/server';
import { desc, eq, and, sql } from 'drizzle-orm';
import { people, scoreSnapshots, cacheEntries } from '@pai/db';
import { db } from '../../../../lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

// GDELT artlist timespan in minutes (used for 24h and 30d only)
const GDELT_TIMESPANS: Record<string, string> = {
  '24h': '1440',
  '30d': '20160', // 14 days — 30d (43200) hits GDELT query-complexity limits
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


/**
 * Fetch Google News RSS for a person and count articles published in the last
 * withinMinutes. Returns article count (0 if none or on error).
 *
 * Google News RSS is free, requires no API key, and is not rate-limited the
 * way Wikimedia is from cloud IPs. Each RSS feed returns ~10 recent articles
 * with ISO pubDate timestamps — we filter to the last hour window.
 */
async function fetchGoogleNews1h(name: string, withinMinutes = 75): Promise<number> {
  const query = encodeURIComponent(`"${name}"`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!res.ok) return 0;
    const xml = await res.text();
    const cutoff = Date.now() - withinMinutes * 60 * 1000;
    const pubDates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)]
      .slice(1) // skip channel-level pubDate
      .map(m => new Date(m[1]!).getTime());
    return pubDates.filter(t => t >= cutoff).length;
  } catch {
    return 0;
  }
}

/**
 * Query Google News for all tracked people in parallel batches of 10.
 * Returns only people who had at least 1 article in the last hour.
 */
async function fetchAllGoogleNews1h(
  people: ScoredPerson[],
): Promise<Array<{ person: ScoredPerson; count: number }>> {
  const CONCURRENCY = 10;
  const results: Array<{ person: ScoredPerson; count: number }> = [];

  console.log(`[1h] Querying Google News RSS for ${people.length} people...`);
  for (let i = 0; i < people.length; i += CONCURRENCY) {
    const batch = people.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async p => ({ person: p, count: await fetchGoogleNews1h(p.displayName) })),
    );
    results.push(...batchResults);
    if (i + CONCURRENCY < people.length) await delay(300);
  }

  const matched = results.filter(r => r.count > 0);
  console.log(`[1h] ${matched.length} people with news in the last hour`);
  return matched;
}

/**
 * Compute live heat from real-time activity — changes every cron run.
 *
 * 1h  (Google News article count): 1 article → 29, 3 → 58, 5 → 75, 10 → 100
 * 24h/30d (GDELT article count):   1 → 15, 10 → 52, 30 → 74, 100 → 100
 */
function computeLiveHeat(timespan: string, metricValue: number): number {
  if (timespan === '1h') {
    return Math.min(100, (Math.log1p(metricValue) / Math.log1p(10)) * 100);
  }
  return Math.min(100, (Math.log1p(metricValue) / Math.log1p(100)) * 100);
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

  // ── trending:1h — Google News RSS ─────────────────────────────────────────
  // Count news articles published about each person in the last 75 minutes.
  // Google News is free, no API key, and not rate-limited from cloud IPs the
  // way Wikimedia is. The list changes every cron run based on who is actually
  // in the news right now.
  const gnData = await fetchAllGoogleNews1h(scoredPeople);

  const trending1h = gnData
    .map(({ person: p, count }) => ({
      rank: 0, wikidataQid: p.wikidataQid, displayName: p.displayName,
      photoUrl: p.photoUrl, occupationSummary: p.occupationSummary,
      popularityScore: p.popularityScore, heatScore: p.heatScore,
      coverageScore: p.coverageScore, coverageLabel: 'Partial coverage',
      scoreModelVersion: p.scoreModelVersion, calculatedAt: p.calculatedAt,
      articleCount: count,
      liveHeat: computeLiveHeat('1h', count),
      trendingScore: count,
      trendingArticles: [] as GDELTArticle[],
    }))
    .sort((a, b) => b.trendingScore - a.trendingScore || b.popularityScore - a.popularityScore)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const trending1hFinal = trending1h.length > 0
    ? trending1h
    : scoredPeople
        .filter(p => p.heatScore > 0)
        .sort((a, b) => b.heatScore - a.heatScore)
        .slice(0, 50)
        .map((p, i) => ({
          rank: i + 1, wikidataQid: p.wikidataQid, displayName: p.displayName,
          photoUrl: p.photoUrl, occupationSummary: p.occupationSummary,
          popularityScore: p.popularityScore, heatScore: p.heatScore,
          coverageScore: p.coverageScore, coverageLabel: 'Partial coverage',
          scoreModelVersion: p.scoreModelVersion, calculatedAt: p.calculatedAt,
          articleCount: 0, liveHeat: p.heatScore, trendingScore: p.heatScore,
          trendingArticles: [] as GDELTArticle[],
        }));

  await conn
    .insert(cacheEntries)
    .values({ key: 'trending:1h', data: trending1hFinal, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cacheEntries.key, set: { data: trending1hFinal, updatedAt: new Date() } });
  results['1h'] = trending1hFinal.length;

  // ── trending:24h and trending:30d — GDELT news articles ───────────────────
  // 10 names per batch — GDELT rejects long OR queries. Sequential with 2s gaps
  // to avoid rate limiting. 200 people / 10 per batch = 20 batches × 2 timespans
  // + discovery + feed ≈ 45 calls. At 2s delay: ~90s — within maxDuration=300.
  const BATCH = 10;
  const nameBatches: string[] = [];
  for (let i = 0; i < scoredPeople.length; i += BATCH) {
    nameBatches.push(
      `(${scoredPeople.slice(i, i + BATCH).map(p => `"${p.displayName}"`).join(' OR ')})`,
    );
  }

  // Per-person news map accumulated across timespans, used to populate person pages
  const personNewsMap = new Map<string, GDELTArticle[]>();

  for (const [timespan, gdeltMinutes] of Object.entries(GDELT_TIMESPANS)) {
    // Run batches sequentially with 2s gaps
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

    const totalArticles = unique.length;

    const trending = scoredPeople
      .filter(p => (countMap.get(p.wikidataQid)?.length ?? 0) >= 2)
      .map(p => {
        const articles = countMap.get(p.wikidataQid)!;
        const liveHeat = computeLiveHeat(timespan, articles.length);
        const scoreBoost = 1 + Math.log1p(p.popularityScore) / 20;
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
          liveHeat,
          trendingScore:     articles.length * scoreBoost,
          trendingArticles:  articles.slice(0, 5),
        };
      })
      .sort((a, b) => b.liveHeat - a.liveHeat || b.trendingScore - a.trendingScore)
      .slice(0, 50)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    // Don't overwrite existing cache with empty results — GDELT is rate-limited
    // from Vercel IPs when queried too frequently. If GDELT returned 0 articles
    // the worker's Wikipedia-based data (written every 15 min) is fresher anyway.
    if (totalArticles === 0) {
      console.log(`[${timespan}] GDELT returned 0 articles — skipping cache write to preserve existing data`);
      results[timespan] = 0;
      continue;
    }

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
