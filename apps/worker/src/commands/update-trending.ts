import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, people, scoreSnapshots, cacheEntries } from '@pai/db';
import { desc, eq, and, sql } from 'drizzle-orm';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

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
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { articles?: unknown[] };
    return data.articles?.length ?? 0;
  } catch {
    return 0;
  }
}

async function fetchNewsFeed(names: string[]): Promise<unknown[]> {
  const orQuery = names.map(n => `"${n}"`).join(' OR ');
  const params = new URLSearchParams({
    query: orQuery, mode: 'artlist', maxrecords: '20',
    format: 'json', timespan: '1440', sort: 'DateDesc',
  });
  try {
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: unknown[] };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

const db = await getDb();

// Get top 50 scored people by popularity
const latestScores = db
  .select({
    personId: scoreSnapshots.personId,
    maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
  })
  .from(scoreSnapshots)
  .groupBy(scoreSnapshots.personId)
  .as('latest_scores');

const topPeople = await db
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
    explanationJson: scoreSnapshots.explanationJson,
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
  console.log('No scored people found. Run `pnpm score:calculate` first.');
  process.exit(0);
}

console.log(`Fetching GDELT trending data for top ${topPeople.length} people...`);

// Fetch article counts for each timespan
for (const [timespan, gdeltMinutes] of Object.entries(GDELT_TIMESPANS)) {
  console.log(`\n[${timespan}] Fetching article counts...`);
  const counts: Array<{ qid: string; count: number }> = [];

  // Fetch in batches of 10 to avoid overwhelming GDELT
  const BATCH = 10;
  for (let i = 0; i < topPeople.length; i += BATCH) {
    const batch = topPeople.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(p =>
        fetchGDELTCount(p.displayName, gdeltMinutes).then(n => ({ qid: p.wikidataQid, n })),
      ),
    );
    counts.push(...results.map(r => ({ qid: r.qid, count: r.n })));
    process.stdout.write(`  ${Math.min(i + BATCH, topPeople.length)}/${topPeople.length}\r`);
  }

  const countMap = new Map(counts.map(r => [r.qid, r.count]));

  const entries = topPeople
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

  await db
    .insert(cacheEntries)
    .values({ key: `trending:${timespan}`, data: entries, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { data: entries, updatedAt: new Date() },
    });

  console.log(`[${timespan}] Stored ${entries.length} entries in cache`);
}

// Update news feed cache
console.log('\nFetching news feed...');
const topNames = topPeople.slice(0, 8).map(p => p.displayName);
const rawArticles = await fetchNewsFeed(topNames);

const feedArticles = rawArticles.map((a) => {
  const article = a as { title: string; url: string; domain: string; seendate: string };
  const matched =
    topPeople.find(p =>
      article.title.toLowerCase().includes(
        p.displayName.toLowerCase().split(' ')[0] ?? '',
      ),
    ) ?? topPeople[0]!;
  return {
    title: article.title,
    url: article.url,
    domain: article.domain,
    seendate: article.seendate,
    personName: matched.displayName,
    personQid: matched.wikidataQid,
  };
});

await db
  .insert(cacheEntries)
  .values({ key: 'news_feed', data: feedArticles, updatedAt: new Date() })
  .onConflictDoUpdate({
    target: cacheEntries.key,
    set: { data: feedArticles, updatedAt: new Date() },
  });

console.log(`News feed: ${feedArticles.length} articles stored`);
console.log('\nTrending update complete!');
