import type { AttentionProvider, ProviderRequest, ProviderResult, RawObservation } from '@pai/shared';

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

const POSITIVE = new Set([
  'win', 'wins', 'won', 'victory', 'success', 'award', 'awards', 'prize', 'champion',
  'best', 'great', 'love', 'praised', 'celebrated', 'honor', 'honours', 'nominated',
  'popular', 'amazing', 'iconic', 'legend', 'breakthrough', 'milestone', 'acclaimed',
  'impressive', 'stunning', 'remarkable', 'outstanding', 'incredible', 'excellent',
  'sold', 'launch', 'new', 'record', 'top', 'historic', 'landmark', 'proud',
]);

const NEGATIVE = new Set([
  'scandal', 'arrested', 'charged', 'convicted', 'guilty', 'fired', 'quit',
  'resign', 'resigns', 'resigned', 'loss', 'loses', 'lost', 'fails', 'failed',
  'death', 'died', 'dead', 'murdered', 'killed', 'accident', 'abuse', 'abused',
  'allegations', 'accused', 'lawsuit', 'sued', 'controversy', 'boycott', 'backlash',
  'criticism', 'criticized', 'slammed', 'attacked', 'drama', 'feud', 'crisis',
  'trouble', 'ban', 'banned', 'arrest', 'crime', 'fraud', 'lie', 'lied', 'fake',
]);

function scoreHeadlines(headlines: string[]): {
  sentimentScore: number;
  positiveShare: number;
  negativeShare: number;
  neutralShare: number;
  controversyScore: number;
  confidence: number;
} {
  if (headlines.length === 0) {
    return { sentimentScore: 0, positiveShare: 0.5, negativeShare: 0.1, neutralShare: 0.4, controversyScore: 5, confidence: 0 };
  }
  let pos = 0, neg = 0, neut = 0;
  for (const h of headlines) {
    const words = h.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const posHits = words.filter(w => POSITIVE.has(w)).length;
    const negHits = words.filter(w => NEGATIVE.has(w)).length;
    if (posHits > negHits) pos++;
    else if (negHits > posHits) neg++;
    else neut++;
  }
  const total = headlines.length;
  const positiveShare = pos / total;
  const negativeShare = neg / total;
  const neutralShare = neut / total;
  const sentimentScore = (positiveShare - negativeShare) * 100;
  const controversyScore = Math.min(positiveShare, negativeShare) * 200;
  const confidence = Math.min(70, total * 3);
  return { sentimentScore, positiveShare, negativeShare, neutralShare, controversyScore, confidence };
}

interface GDELTArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language?: string;
}

async function fetchArticles(name: string, timespan: string): Promise<GDELTArticle[]> {
  const params = new URLSearchParams({
    query: `"${name}"`,
    mode: 'artlist',
    maxrecords: '250',
    format: 'json',
    timespan,
    sort: 'DateDesc',
  });
  try {
    const res = await fetch(`${GDELT_BASE}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { articles?: GDELTArticle[] };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export class GDELTNewsProvider implements AttentionProvider {
  readonly providerName = 'gdelt_news';
  readonly providerType = 'live' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const name = input.displayName;
    const now = new Date();
    if (!name) {
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'NO_NAME', message: 'displayName required', retryable: false }], fetchedAt: now };
    }

    try {
      const [articles7d, articles30d] = await Promise.all([
        fetchArticles(name, '7d'),
        fetchArticles(name, '30d'),
      ]);

      const count7d = articles7d.length;
      const count30d = Math.max(count7d, articles30d.length);
      const uniqueDomains = new Set(articles7d.map(a => a.domain)).size;
      const sourceDiversity = count7d > 0 ? Math.min(1, (uniqueDomains / count7d) * 3) : 0;
      const rate7d = count7d / 7;
      const rate30d = count30d / 30;
      const velocity = rate30d > 0 ? rate7d / rate30d : 1.0;

      const observations: RawObservation[] = [
        { metricType: 'news_article_count_7d', metricValue: count7d, observedAt: now, payload: { provider: 'gdelt', query: name }, reliabilityScore: 0.75 },
        { metricType: 'news_source_diversity', metricValue: sourceDiversity, observedAt: now, payload: { provider: 'gdelt', uniqueDomains }, reliabilityScore: 0.75 },
        { metricType: 'news_velocity', metricValue: velocity, observedAt: now, payload: { provider: 'gdelt' }, reliabilityScore: 0.7 },
      ];

      const headlines = articles7d.filter(a => !a.language || a.language === 'English').map(a => a.title).filter(Boolean);
      const sent = scoreHeadlines(headlines);
      observations.push(
        { metricType: 'sentiment_score', metricValue: sent.sentimentScore, observedAt: now, payload: { provider: 'gdelt', headlinesAnalyzed: headlines.length }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'sentiment_positive_share', metricValue: sent.positiveShare, observedAt: now, payload: { provider: 'gdelt' }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'sentiment_neutral_share', metricValue: sent.neutralShare, observedAt: now, payload: { provider: 'gdelt' }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'sentiment_negative_share', metricValue: sent.negativeShare, observedAt: now, payload: { provider: 'gdelt' }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'controversy_score', metricValue: sent.controversyScore, observedAt: now, payload: { provider: 'gdelt' }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'sentiment_confidence', metricValue: sent.confidence, observedAt: now, payload: { provider: 'gdelt' }, reliabilityScore: 0.8 },
      );

      return { providerName: this.providerName, providerType: this.providerType, success: true, observations, errors: [], fetchedAt: now };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'GDELT_ERROR', message, retryable: true }], fetchedAt: now };
    }
  }
}
