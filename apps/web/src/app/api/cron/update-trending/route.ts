/**
 * Trending cron — hybrid approach:
 *
 * trending:1h  → Wikipedia hourly page views (real-time, no IP blocks).
 *                Ranked purely by view count so whoever people are ACTUALLY
 *                reading right now rises to the top regardless of fame.
 *                Wikimedia data lags ~1 hour so we try the current hour first,
 *                then fall back to the previous completed hour.
 *
 * trending:24h → GDELT news articles for last 24h, mild popularity tiebreak.
 * trending:30d → GDELT news articles for last 14 days, mild popularity tiebreak.
 *
 * Both GDELT timespans use a small popularity multiplier (log/20) so two people
 * with the same article count rank by established audience, but raw article
 * count still dominates.
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

// Wikipedia hourly/daily top-articles endpoint (used for 1h trending)
async function fetchWikipediaTop(
  year: string, month: string, day: string, hour?: string,
): Promise<Array<{ article: string; views: number }>> {
  const path = hour
    ? `metrics/pageviews/top/en.wikipedia.org/all-access/${year}/${month}/${day}/${hour}`
    : `metrics/pageviews/top/en.wikipedia.org/all-access/${year}/${month}/${day}`;
  try {
    const res = await fetch(`https://wikimedia.org/api/rest_v1/${path}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.log(`[wiki] ${res.status} for ${path}`);
      return [];
    }
    const data = await res.json() as { items?: Array<{ articles: Array<{ article: string; views: number }> }> };
    const articles = data.items?.[0]?.articles ?? [];
    console.log(`[wiki] 200 for ${path} → ${articles.length} articles`);
    return articles;
  } catch (err) {
    console.log(`[wiki] error for ${path}:`, err);
    return [];
  }
}

// Wikimedia hourly endpoint lags 1-3+ hours. Try going back up to maxBack hours.
async function fetchWikipediaHourly(
  now: Date, maxBack = 4,
): Promise<Array<{ article: string; views: number }>> {
  const pad = (n: number) => String(n).padStart(2, '0');
  for (let back = 0; back <= maxBack; back++) {
    const t = new Date(now);
    t.setUTCHours(t.getUTCHours() - back);
    const articles = await fetchWikipediaTop(
      t.getUTCFullYear().toString(),
      pad(t.getUTCMonth() + 1),
      pad(t.getUTCDate()),
      pad(t.getUTCHours()),
    );
    if (articles.length > 0) {
      console.log(`[1h] Using -${back}h data (${pad(t.getUTCHours())}:xx UTC)`);
      return articles;
    }
  }
  return [];
}

/**
 * Compute a live heat score from real-time activity data for the current cron period.
 *
 * This deliberately ignores the stored heatScore — we want a value that genuinely
 * changes every run based on what just happened:
 *
 * 1h  (Wikipedia views): log10 scale anchored at 1M theoretical max.
 *     1K views → ~50,  10K → ~67,  100K → ~83,  1M → 100
 *
 * 24h/30d (GDELT article count): log1p scale anchored at 100 articles.
 *     1 article → 15,  5 → 37,  10 → 52,  30 → 74,  100 → 100
 */
function computeLiveHeat(timespan: string, metricValue: number): number {
  if (timespan === '1h') {
    return Math.min(100, (Math.log10(Math.max(1, metricValue)) / 6) * 100);
  }
  return Math.min(100, (Math.log1p(metricValue) / Math.log1p(100)) * 100);
}

const WIKI_SYSTEM_PREFIXES = ['Special:', 'Wikipedia:', 'Portal:', 'Help:', 'Template:', 'File:', 'Category:', 'Talk:'];
function isPersonArticle(title: string): boolean {
  return !WIKI_SYSTEM_PREFIXES.some(p => title.startsWith(p))
    && title !== 'Main_Page'
    && !title.includes('_(disambiguation)');
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

  // Build Wikipedia article title → person lookup for 1h matching
  const titleToPerson = new Map<string, ScoredPerson>();
  for (const p of scoredPeople) {
    titleToPerson.set(p.displayName.replace(/ /g, '_'), p);
  }

  const results: Record<string, number> = {};

  // ── trending:1h — Wikipedia hourly page views ──────────────────────────────
  // Wikimedia publishes hourly top-articles data with 1-3+ hour lag.
  // Try up to 4 hours back before falling through to heat score.
  const now = new Date();

  const wikiHourly = await fetchWikipediaHourly(now, 4);

  const hourlyMatches = wikiHourly
    .filter(a => isPersonArticle(a.article))
    .filter(a => titleToPerson.has(a.article));

  // Rank PURELY by Wikipedia page views — no popularity multiplier.
  // liveHeat is derived from actual hourly views, changes every cron run.
  const trending1h = hourlyMatches
    .map(a => {
      const p = titleToPerson.get(a.article)!;
      return {
        rank: 0, wikidataQid: p.wikidataQid, displayName: p.displayName,
        photoUrl: p.photoUrl, occupationSummary: p.occupationSummary,
        popularityScore: p.popularityScore, heatScore: p.heatScore,
        coverageScore: p.coverageScore, coverageLabel: 'Partial coverage',
        scoreModelVersion: p.scoreModelVersion, calculatedAt: p.calculatedAt,
        articleCount: a.views,
        liveHeat: computeLiveHeat('1h', a.views),
        trendingScore: a.views,
        trendingArticles: [] as GDELTArticle[],
      };
    })
    .sort((a, b) => b.liveHeat - a.liveHeat)
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

    const trending = scoredPeople
      .filter(p => (countMap.get(p.wikidataQid)?.length ?? 0) >= 2)
      .map(p => {
        const articles = countMap.get(p.wikidataQid)!;
        // liveHeat derived from article count — changes every cron run.
        // Mild popularity tiebreak (log/20) only used for secondary sort within ties.
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
