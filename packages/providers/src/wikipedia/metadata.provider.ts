import type { AttentionProvider, ProviderRequest, ProviderResult, RawObservation } from '@pai/shared';

const API_BASE = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0 (contact@example.com)';

interface MediaWikiResponse {
  query?: {
    pages?: Record<string, {
      ns?: number;
      title?: string;
      length?: number;
      langlinkscount?: number;
      extlinks?: unknown[];
    }>;
  };
}

export class WikipediaMetadataProvider implements AttentionProvider {
  readonly providerName = 'wikipedia_metadata';
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

    const params = new URLSearchParams({
      action: 'query',
      prop: 'info|langlinkscount|extlinks',
      titles: title.replace(/_/g, ' '),
      format: 'json',
      inprop: 'length',
      ellimit: '500',
      origin: '*',
    });

    const url = `${API_BASE}?${params.toString()}`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as MediaWikiResponse;
      const pages = data.query?.pages;
      if (!pages) throw new Error('No pages in response');

      const page = Object.values(pages)[0];
      if (!page) throw new Error('Empty pages object');

      const observations: RawObservation[] = [];
      const now = new Date();

      if (page.langlinkscount !== undefined) {
        observations.push({
          metricType: 'wikipedia_language_editions',
          metricValue: page.langlinkscount,
          observedAt: now,
          payload: { title },
          reliabilityScore: 0.95,
        });
      }

      if (page.length !== undefined) {
        observations.push({
          metricType: 'wikipedia_article_length',
          metricValue: page.length,
          observedAt: now,
          payload: { title },
          reliabilityScore: 0.9,
        });
      }

      const extlinkCount = Array.isArray(page.extlinks) ? page.extlinks.length : 0;
      observations.push({
        metricType: 'wikipedia_external_links',
        metricValue: extlinkCount,
        observedAt: now,
        payload: { title },
        reliabilityScore: 0.85,
      });

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
