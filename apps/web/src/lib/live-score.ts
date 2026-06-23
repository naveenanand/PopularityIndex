import { calculateScores } from '@pai/scoring';
import type { ScoringFeatures } from '@pai/shared';
import type { ScoreEngineOutput } from '@pai/scoring';
import type { RawPersonObservations } from './api';

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';
const WIKIMEDIA_UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

const POSITIVE = new Set([
  'win','wins','won','victory','success','award','awards','prize','champion',
  'best','great','love','praised','celebrated','honor','honours','nominated',
  'popular','amazing','iconic','legend','breakthrough','milestone','acclaimed',
  'impressive','stunning','remarkable','outstanding','incredible','excellent',
  'sold','launch','new','record','top','historic','landmark','proud',
]);
const NEGATIVE = new Set([
  'scandal','arrested','charged','convicted','guilty','fired','quit',
  'resign','resigns','resigned','loss','loses','lost','fails','failed',
  'death','died','dead','murdered','killed','accident','abuse','abused',
  'allegations','accused','lawsuit','sued','controversy','boycott','backlash',
  'criticism','criticized','slammed','attacked','drama','feud','crisis',
  'trouble','ban','banned','arrest','crime','fraud','lie','lied','fake',
]);

interface GDELTArticle { domain: string; title: string; language?: string }

async function fetchGDELT(name: string, timespan: string) {
  const params = new URLSearchParams({
    query: `"${name}"`, mode: 'artlist', maxrecords: '250',
    format: 'json', timespan, sort: 'DateDesc',
  });
  try {
    const res = await fetch(`${GDELT_BASE}?${params}`, {
      headers: { 'User-Agent': WIKIMEDIA_UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { count: 0, domains: [] as string[], titles: [] as string[] };
    const data = (await res.json()) as { articles?: GDELTArticle[] };
    const articles = data.articles ?? [];
    return {
      count: articles.length,
      domains: articles.map(a => a.domain),
      titles: articles.filter(a => !a.language || a.language === 'English').map(a => a.title),
    };
  } catch {
    return { count: 0, domains: [] as string[], titles: [] as string[] };
  }
}

async function fetchWikipediaTrending(displayName: string) {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const ago31 = new Date();
  ago31.setUTCDate(ago31.getUTCDate() - 31);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  const base = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia.org/all-access';
  try {
    const [r1, r31] = await Promise.all([
      fetch(`${base}/${fmt(yesterday)}`, { signal: AbortSignal.timeout(10_000) }),
      fetch(`${base}/${fmt(ago31)}`, { signal: AbortSignal.timeout(10_000) }),
    ]);
    if (!r1.ok || !r31.ok) return { searchInterest: 0, searchSpike: 1, searchVelocity: 0 };
    type TopResp = { items?: [{ articles?: { article: string; rank: number }[] }] };
    const [d1, d31] = (await Promise.all([r1.json(), r31.json()])) as [TopResp, TopResp];
    const arts1 = d1.items?.[0]?.articles ?? [];
    const arts31 = d31.items?.[0]?.articles ?? [];
    const key = displayName.replace(/ /g, '_').toLowerCase();
    const rank1 = arts1.find(a => a.article.toLowerCase() === key)?.rank;
    const rank31 = arts31.find(a => a.article.toLowerCase() === key)?.rank;
    const toInterest = (r: number | undefined) => r !== undefined ? Math.max(0, 99 - (r / 1000) * 99) : 0;
    return {
      searchInterest: toInterest(rank1),
      searchSpike: rank1 !== undefined && rank31 !== undefined ? rank31 / Math.max(1, rank1) : 1,
      searchVelocity: rank1 !== undefined && rank31 !== undefined ? (rank31 - rank1) / 1000 : 0,
    };
  } catch {
    return { searchInterest: 0, searchSpike: 1, searchVelocity: 0 };
  }
}

function scoreSentiment(titles: string[]) {
  if (titles.length === 0) return null;
  let pos = 0, neg = 0, neut = 0;
  for (const h of titles) {
    const words = h.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const p = words.filter(w => POSITIVE.has(w)).length;
    const n = words.filter(w => NEGATIVE.has(w)).length;
    if (p > n) pos++; else if (n > p) neg++; else neut++;
  }
  const total = titles.length;
  const ps = pos / total, ns = neg / total, nu = neut / total;
  return {
    sentimentScore: (ps - ns) * 100,
    positiveShare: ps, negativeShare: ns, neutralShare: nu,
    controversyScore: Math.min(ps, ns) * 200,
    confidence: Math.min(70, total * 3),
  };
}

export async function computeLiveScore(
  personId: number,
  displayName: string,
  rawObs: RawPersonObservations,
): Promise<ScoreEngineOutput> {
  const [gdelt24h, gdelt7d, trending] = await Promise.all([
    fetchGDELT(displayName, '24h'),
    fetchGDELT(displayName, '7d'),
    fetchWikipediaTrending(displayName),
  ]);

  const features: ScoringFeatures = {};

  // Wikipedia pageviews from DB
  const { pageviews, sourceObs } = rawObs;
  if (pageviews.length > 0) {
    const sorted = [...pageviews].sort((a, b) => b.date.localeCompare(a.date));
    const total = sorted.reduce((s, r) => s + r.views, 0);
    features.wikipediaPageviewAverage30d = total / Math.min(sorted.length, 30);
    const r7 = sorted.slice(0, 7);
    features.wikipediaPageviewAverage7d = r7.reduce((s, r) => s + r.views, 0) / Math.max(1, r7.length);
    features.wikipediaPageviewAverage90d = total / Math.max(1, sorted.length);
    features.wikipediaPageviewSpike7d = (features.wikipediaPageviewAverage7d) / Math.max(1, features.wikipediaPageviewAverage90d);
  }
  for (const o of sourceObs) {
    if (o.metricType === 'wikidata_sitelinks') features.wikipediaSitelinks = o.metricValue;
    if (o.metricType === 'wikipedia_language_editions') {
      features.wikipediaLanguageEditions = o.metricValue;
      if (!features.wikipediaSitelinks) features.wikipediaSitelinks = o.metricValue;
    }
    if (o.metricType === 'wikipedia_article_length') features.wikipediaArticleLength = o.metricValue;
  }

  // Live GDELT
  features.newsCoverageVolume24h = gdelt24h.count;
  features.newsCoverageVolume7d = gdelt7d.count;
  features.newsSourceDiversity = gdelt7d.count > 0
    ? Math.min(1, (new Set(gdelt7d.domains).size / gdelt7d.count) * 3) : 0;
  const dailyRate7d = gdelt7d.count / 7;
  features.newsVelocity = dailyRate7d > 0 ? gdelt24h.count / dailyRate7d : gdelt24h.count > 0 ? 5 : 1;

  // Sentiment from GDELT headlines
  const sentiment = scoreSentiment(gdelt7d.titles);
  if (sentiment) {
    features.sentimentScore = sentiment.sentimentScore;
    features.sentimentPositiveShare = sentiment.positiveShare;
    features.sentimentNeutralShare = sentiment.neutralShare;
    features.sentimentNegativeShare = sentiment.negativeShare;
    features.controversyScore = sentiment.controversyScore;
    features.sentimentConfidence = sentiment.confidence;
  }

  // Live Wikipedia trending
  features.searchInterestIndex = trending.searchInterest;
  features.searchSpike = trending.searchSpike;
  features.searchTrendVelocity = trending.searchVelocity;

  return calculateScores({ personId, features });
}
