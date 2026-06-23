import type { AttentionProvider, ProviderRequest, ProviderResult, RawObservation } from '@pai/shared';

const PAGEVIEWS_BASE = process.env['WIKIMEDIA_PAGEVIEWS_BASE'] ?? 'https://wikimedia.org/api/rest_v1';
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0 (contact@example.com)';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function encodeTitle(title: string): string {
  return encodeURIComponent(title.replace(/ /g, '_'));
}

interface PageviewItem {
  article: string;
  timestamp: string;
  views: number;
}

interface PageviewResponse {
  items?: PageviewItem[];
}

export class WikipediaPageviewsProvider implements AttentionProvider {
  readonly providerName = 'wikipedia_pageviews';
  readonly providerType = 'live' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const title = input.wikipediaPageTitle;
    if (!title) {
      return {
        providerName: this.providerName,
        providerType: this.providerType,
        success: false,
        observations: [],
        errors: [{ code: 'NO_PAGE_TITLE', message: 'No Wikipedia page title provided', retryable: false }],
        fetchedAt: new Date(),
      };
    }

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);

    const url = `${PAGEVIEWS_BASE}/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeTitle(title)}/daily/${formatDate(from)}/${formatDate(to)}`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (res.status === 404) {
        // No data for this period — valid, not an error
        return {
          providerName: this.providerName,
          providerType: this.providerType,
          success: true,
          observations: [],
          errors: [],
          fetchedAt: new Date(),
        };
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as PageviewResponse;
      const items = data.items ?? [];

      const observations: RawObservation[] = [];
      const now = new Date();

      let totalViews = 0;
      let recentViews7d = 0;
      const cutoff7d = new Date();
      cutoff7d.setDate(cutoff7d.getDate() - 7);

      for (const item of items) {
        // Store individual daily observation
        const itemDate = new Date(
          `${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}-${item.timestamp.slice(6, 8)}`,
        );

        observations.push({
          metricType: 'wikipedia_daily_pageviews',
          metricValue: item.views,
          observedAt: now,
          payload: { date: item.timestamp, title },
          reliabilityScore: 0.95,
        });

        totalViews += item.views;
        if (itemDate >= cutoff7d) {
          recentViews7d += item.views;
        }
      }

      if (items.length > 0) {
        const avg30d = totalViews / Math.min(items.length, 30);
        const avg90d = totalViews / items.length;
        const avg7d = recentViews7d / 7;

        observations.push({
          metricType: 'wikipedia_pageview_average',
          metricValue: avg30d,
          observedAt: now,
          payload: { window_days: 30, title },
          reliabilityScore: 0.95,
        });

        // Spike ratio: 7-day avg vs 90-day avg
        const spikeRatio = avg7d / Math.max(1, avg90d);
        observations.push({
          metricType: 'wikipedia_pageview_spike_ratio',
          metricValue: spikeRatio,
          observedAt: now,
          payload: { avg_7d: avg7d, avg_90d: avg90d, title },
          reliabilityScore: 0.9,
        });
      }

      return {
        providerName: this.providerName,
        providerType: this.providerType,
        success: true,
        observations,
        errors: [],
        fetchedAt: new Date(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        providerName: this.providerName,
        providerType: this.providerType,
        success: false,
        observations: [],
        errors: [{ code: 'FETCH_ERROR', message, retryable: true }],
        fetchedAt: new Date(),
      };
    }
  }
}
