/**
 * Trending update — discovery-only approach.
 *
 * 3 GDELT calls (one per timespan) + 1 feed call = 4 total per run.
 * Previously 42+ OR-batch calls → all got 429 from GitHub Actions IPs.
 *
 * The discovery query returns 250 broad-topic articles per timespan.
 * We match titles against all scored people's display names in JS.
 * People genuinely trending will appear in those 250 articles.
 */

import { findUp } from 'find-up';
import { config } from 'dotenv';
import { getDb, people, scoreSnapshots, cacheEntries } from '@pai/db';
import { desc, eq, and, sql } from 'drizzle-orm';

const envPath = await findUp('.env');
if (envPath) config({ path: envPath });

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

interface GDELTArticle {
  title: string;
  url: string;
  domain: string;
  seendate: string;
}

interface ScoredPerson {
  personId: number;
  wikidataQid: string;
  displayName: string;
  photoUrl: string | null;
  occupationSummary: string | null;
  popularityScore: number;
  heatScore: number;
  coverageScore: number;
  confidenceScore: number;
  scoreModelVersion: string;
  calculatedAt: Date;
}

const GDELT_TIMESPANS: Record<string, string> = {
  '1h':  '60',
  '24h': '1440',
  '30d': '20160',
};

// 6s gap between GDELT calls — safely above the 1 req/5s limit.
const RATE_LIMIT_MS = 6_000;

// Single broad query that catches political, cultural, sports, and business news.
// Returns 250 articles per call; we JS-match titles against scored people names.
const DISCOVERY_QUERY =
  '(president OR minister OR senator OR CEO OR actor OR singer OR athlete OR champion OR arrested OR elected OR appointed OR died OR resigned OR awarded OR appointed)';

async function fetchGDELTArticles(query: string, gdeltMinutes: string): Promise<GDELTArticle[]> {
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
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      process.stderr.write(`  GDELT HTTP ${res.status} for timespan=${gdeltMinutes}\n`);
      return [];
    }
    const text = await res.text();
    if (!text.startsWith('{') && !text.startsWith('[')) {
      process.stderr.write(`  GDELT rate-limited: ${text.slice(0, 80)}\n`);
      return [];
    }
    const data = JSON.parse(text) as { articles?: GDELTArticle[] };
    return data.articles ?? [];
  } catch (err) {
    process.stderr.write(`  GDELT fetch error: ${err}\n`);
    return [];
  }
}

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

function dedupe(articles: GDELTArticle[]): GDELTArticle[] {
  return [...new Map(articles.map(a => [a.url, a])).values()];
}

const db = await getDb();

const latestScores = db
  .select({
    personId: scoreSnapshots.personId,
    maxCalcAt: sql<string>`max(${scoreSnapshots.calculatedAt})`.as('max_calc_at'),
  })
  .from(scoreSnapshots)
  .groupBy(scoreSnapshots.personId)
  .as('latest_scores');

const scoredPeople: ScoredPerson[] = await db
  .select({
    personId: people.id,
    wikidataQid: people.wikidataQid,
    displayName: people.displayName,
    photoUrl: people.photoUrl,
    occupationSummary: people.occupationSummary,
    popularityScore: scoreSnapshots.popularityScore,
    heatScore: scoreSnapshots.heatScore,
    coverageScore: scoreSnapshots.coverageScore,
    confidenceScore: scoreSnapshots.confidenceScore,
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
  console.log('No scored people found. Run `pnpm score:calculate` first.');
  process.exit(0);
}

console.log(`Found ${scoredPeople.length} scored people to match against.`);

// Per-person news map: accumulated across all timespans
const personNewsMap = new Map<string, GDELTArticle[]>();
let hourlyCountMap = new Map<string, GDELTArticle[]>();

for (const [timespan, gdeltMinutes] of Object.entries(GDELT_TIMESPANS)) {
  console.log(`\n[${timespan}] Fetching discovery articles (1 GDELT call)...`);

  const articles = await fetchGDELTArticles(DISCOVERY_QUERY, gdeltMinutes);
  const unique = dedupe(articles);
  console.log(`  → ${unique.length} unique articles`);

  // JS title-match: find which scored people appear in these articles
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

  // Accumulate into global per-person news map (deduplicate URLs)
  for (const [qid, arts] of countMap) {
    const existing = personNewsMap.get(qid) ?? [];
    const seen = new Set(existing.map(a => a.url));
    for (const a of arts) {
      if (!seen.has(a.url)) { existing.push(a); seen.add(a.url); }
    }
    personNewsMap.set(qid, existing);
  }

  const matched = countMap.size;
  const trending = scoredPeople
    .filter(p => (countMap.get(p.wikidataQid)?.length ?? 0) >= 1)
    .map(p => {
      const arts = countMap.get(p.wikidataQid)!;
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
        articleCount:      arts.length,
        trendingScore:     arts.length * scoreBoost,
        trendingArticles:  arts.slice(0, 5),
      };
    })
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  await db
    .insert(cacheEntries)
    .values({ key: `trending:${timespan}`, data: trending, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { data: trending, updatedAt: new Date() },
    });

  console.log(`[${timespan}] ${matched} people matched → stored ${trending.length} trending entries`);

  if (timespan === '1h') hourlyCountMap = countMap;

  await delay(RATE_LIMIT_MS);
}

// Write per-person news cache — each person gets their own key: news:<qid>
// The /api/news/[qid] route reads from this key, falling back to a live GDELT call.
let personNewsCached = 0;
for (const [qid, arts] of personNewsMap) {
  const sorted = arts
    .sort((a, b) => b.seendate.localeCompare(a.seendate))
    .slice(0, 10);
  await db
    .insert(cacheEntries)
    .values({ key: `news:${qid}`, data: sorted, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { data: sorted, updatedAt: new Date() },
    });
  personNewsCached++;
}
console.log(`\n[news_cache] Stored news for ${personNewsCached} people`);

// Heat score updates — for people with 3+ articles in the last hour, write a new
// score_snapshot with a news-boosted heatScore so the leaderboard reacts in near-real-time.
const heatUpdates: Array<{ name: string; oldHeat: number; newHeat: number }> = [];
for (const person of scoredPeople) {
  if (person.personId === 0) continue; // skip synthetic unscored entries
  const arts = hourlyCountMap.get(person.wikidataQid);
  if (!arts || arts.length < 3) continue;
  const newsBoost = Math.min(50, Math.log1p(arts.length) * 12);
  const newHeat = Math.min(100, person.heatScore + newsBoost);
  if (newHeat - person.heatScore < 3) continue;
  await db.insert(scoreSnapshots).values({
    personId: person.personId,
    calculatedAt: new Date(),
    scoreModelVersion: `${person.scoreModelVersion}-news`,
    popularityScore: person.popularityScore,
    heatScore: newHeat,
    coverageScore: person.coverageScore,
    confidenceScore: person.confidenceScore,
    sentimentScore: null,
    controversyScore: null,
    explanationJson: {
      score_model_version: `${person.scoreModelVersion}-news`,
      popularity_score: person.popularityScore,
      heat_score: newHeat,
      coverage_score: person.coverageScore,
      news_articles_1h: arts.length,
      heat_boost_from_news: newsBoost,
      top_contributors: [
        { signal: 'news_velocity_1h', impact: `+${newsBoost.toFixed(1)}`, reason: `${arts.length} articles in last hour` },
      ],
    },
  });
  heatUpdates.push({ name: person.displayName, oldHeat: person.heatScore, newHeat });
}
if (heatUpdates.length > 0) {
  console.log(`\n[heat] Updated ${heatUpdates.length} people from news spikes:`);
  for (const u of heatUpdates) {
    console.log(`  ${u.name}: ${u.oldHeat.toFixed(1)} → ${u.newHeat.toFixed(1)}`);
  }
}

// News feed — top articles mentioning our most popular people (1 more GDELT call)
console.log('\n[news_feed] Fetching...');
const top8Names = `(${scoredPeople.slice(0, 8).map(p => `"${p.displayName}"`).join(' OR ')})`;
const feedArticles = await fetchGDELTArticles(top8Names, '1440');

const feed = feedArticles.slice(0, 20).map(a => {
  const titleLower = a.title.toLowerCase();
  const matched = scoredPeople.find(p => titleLower.includes(p.displayName.toLowerCase())) ?? scoredPeople[0]!;
  return {
    title:      a.title,
    url:        a.url,
    domain:     a.domain,
    seendate:   a.seendate,
    personName: matched.displayName,
    personQid:  matched.wikidataQid,
  };
});

await db
  .insert(cacheEntries)
  .values({ key: 'news_feed', data: feed, updatedAt: new Date() })
  .onConflictDoUpdate({
    target: cacheEntries.key,
    set: { data: feed, updatedAt: new Date() },
  });

console.log(`[news_feed] Stored ${feed.length} articles`);
console.log('\nTrending update complete! (4 GDELT calls total)');
