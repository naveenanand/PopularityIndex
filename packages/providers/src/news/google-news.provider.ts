import type { AttentionProvider, ProviderRequest, ProviderResult, RawObservation } from '@pai/shared';

const UA = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

// Keyword-based headline sentiment — same logic as GDELT provider
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

function scoreHeadlines(headlines: string[]) {
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
  return {
    sentimentScore: (positiveShare - negativeShare) * 100,
    positiveShare,
    negativeShare,
    neutralShare,
    controversyScore: Math.min(positiveShare, negativeShare) * 200,
    confidence: Math.min(70, total * 3),
  };
}

interface RSSItem {
  title: string;
  source: string;
  pubDate: Date;
}

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  for (const match of blocks) {
    const content = match[1];
    if (!content) continue;
    const rawTitle =
      content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
      content.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
    const decoded = rawTitle
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').trim();
    const dashIdx = decoded.lastIndexOf(' - ');
    const title  = dashIdx > 0 ? decoded.slice(0, dashIdx).trim() : decoded;
    const source = dashIdx > 0 ? decoded.slice(dashIdx + 3).trim() : '';
    const pubRaw = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? '';
    const pubDate = pubRaw ? new Date(pubRaw) : new Date();
    if (title) items.push({ title, source, pubDate });
  }
  return items;
}

async function fetchRSS(displayName: string): Promise<RSSItem[]> {
  const q = encodeURIComponent(`"${displayName}"`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    return parseRSS(await res.text());
  } catch {
    return [];
  }
}

export class GoogleNewsProvider implements AttentionProvider {
  readonly providerName = 'google_news';
  readonly providerType = 'live' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const now = new Date();
    const name = input.displayName;
    if (!name) {
      return {
        providerName: this.providerName, providerType: this.providerType,
        success: false, observations: [], fetchedAt: now,
        errors: [{ code: 'NO_NAME', message: 'displayName required', retryable: false }],
      };
    }

    try {
      const items = await fetchRSS(name);

      const oneDayAgo   = now.getTime() - 86_400_000;
      const sevenDaysAgo = now.getTime() - 7 * 86_400_000;

      const items24h = items.filter(a => a.pubDate.getTime() > oneDayAgo);
      const items7d  = items.filter(a => a.pubDate.getTime() > sevenDaysAgo);

      const count24h      = items24h.length;
      const count7d       = items7d.length;
      const uniqueSources = new Set(items7d.map(a => a.source)).size;
      const sourceDiversity = count7d > 0
        ? Math.min(1, (uniqueSources / count7d) * 3)
        : 0;
      const dailyRate = count7d / 7;
      const velocity = dailyRate > 0 ? count24h / dailyRate : (count24h > 0 ? 5.0 : 1.0);

      const headlines = items7d.map(a => a.title);
      const sent = scoreHeadlines(headlines);

      const observations: RawObservation[] = [
        { metricType: 'news_article_count_24h',  metricValue: count24h,        observedAt: now, payload: { provider: 'google_news', query: name }, reliabilityScore: 0.8 },
        { metricType: 'news_article_count_7d',   metricValue: count7d,         observedAt: now, payload: { provider: 'google_news', query: name }, reliabilityScore: 0.8 },
        { metricType: 'news_source_diversity',   metricValue: sourceDiversity,  observedAt: now, payload: { provider: 'google_news', uniqueSources }, reliabilityScore: 0.8 },
        { metricType: 'news_velocity',           metricValue: velocity,        observedAt: now, payload: { provider: 'google_news', count24h, count7d }, reliabilityScore: 0.75 },
        { metricType: 'sentiment_score',          metricValue: sent.sentimentScore,   observedAt: now, payload: { provider: 'google_news', headlinesAnalyzed: headlines.length }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'sentiment_positive_share', metricValue: sent.positiveShare,    observedAt: now, payload: { provider: 'google_news' }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'sentiment_neutral_share',  metricValue: sent.neutralShare,     observedAt: now, payload: { provider: 'google_news' }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'sentiment_negative_share', metricValue: sent.negativeShare,    observedAt: now, payload: { provider: 'google_news' }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'controversy_score',        metricValue: sent.controversyScore, observedAt: now, payload: { provider: 'google_news' }, reliabilityScore: sent.confidence / 100 },
        { metricType: 'sentiment_confidence',     metricValue: sent.confidence,       observedAt: now, payload: { provider: 'google_news' }, reliabilityScore: 0.8 },
      ];

      return { providerName: this.providerName, providerType: this.providerType, success: true, observations, errors: [], fetchedAt: now };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], fetchedAt: now, errors: [{ code: 'GOOGLE_NEWS_ERROR', message, retryable: true }] };
    }
  }
}
