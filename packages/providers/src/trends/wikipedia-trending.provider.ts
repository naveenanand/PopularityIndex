import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';

const PAGEVIEWS_BASE = process.env['WIKIMEDIA_PAGEVIEWS_BASE'] ?? 'https://wikimedia.org/api/rest_v1';
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0';

interface TopArticlesResponse {
  items?: Array<{ articles: Array<{ article: string; rank: number }> }>;
}

function dateStr(daysAgo: number): { year: string; month: string; day: string } {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    year: String(d.getUTCFullYear()),
    month: String(d.getUTCMonth() + 1).padStart(2, '0'),
    day: String(d.getUTCDate()).padStart(2, '0'),
  };
}

async function fetchRankMap(daysAgo: number): Promise<Map<string, number>> {
  const { year, month, day } = dateStr(daysAgo);
  const url = `${PAGEVIEWS_BASE}/metrics/pageviews/top/en.wikipedia.org/all-access/${year}/${month}/${day}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return new Map();
    const data = (await res.json()) as TopArticlesResponse;
    const map = new Map<string, number>();
    for (const a of (data.items?.[0]?.articles ?? [])) {
      map.set(a.article, a.rank);
    }
    return map;
  } catch {
    return new Map();
  }
}

export class WikipediaTrendingProvider implements AttentionProvider {
  readonly providerName = 'wikipedia_trending';
  readonly providerType = 'live' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const now = new Date();
    const title = input.wikipediaPageTitle ?? input.displayName?.replace(/ /g, '_');
    if (!title) {
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'NO_TITLE', message: 'wikipediaPageTitle or displayName required', retryable: false }], fetchedAt: now };
    }

    try {
      const [rankNow, rank30d] = await Promise.all([
        fetchRankMap(1),   // yesterday
        fetchRankMap(31),  // ~30 days ago
      ]);

      const rankYesterday = rankNow.get(title) ?? 1001;
      const rankBefore = rank30d.get(title) ?? 1001;

      // 0–100 score based on position in top 1000; not ranked = 0
      const searchInterestIndex = rankYesterday <= 1000
        ? (1000 - rankYesterday) / 1000 * 100
        : 0;

      // Positive = trending up (rank number dropped = more popular)
      const velocity = (rankBefore - rankYesterday) / 1000;

      // Spike: how much better ranked now vs 30d ago (>1 = trending)
      const spike = rankBefore / Math.max(1, rankYesterday);

      return {
        providerName: this.providerName, providerType: this.providerType, success: true,
        observations: [
          { metricType: 'search_interest_index', metricValue: searchInterestIndex, observedAt: now, payload: { provider: 'wikipedia_trending', rank: rankYesterday, title }, reliabilityScore: 0.85 },
          { metricType: 'search_trend_velocity', metricValue: velocity, observedAt: now, payload: { provider: 'wikipedia_trending', rankChange: rankBefore - rankYesterday }, reliabilityScore: 0.8 },
          { metricType: 'search_spike', metricValue: spike, observedAt: now, payload: { provider: 'wikipedia_trending' }, reliabilityScore: 0.8 },
        ],
        errors: [], fetchedAt: now,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { providerName: this.providerName, providerType: this.providerType, success: false, observations: [], errors: [{ code: 'TRENDING_ERROR', message, retryable: true }], fetchedAt: now };
    }
  }
}
