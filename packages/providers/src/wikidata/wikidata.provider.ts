import type { AttentionProvider, ProviderRequest, ProviderResult, RawObservation } from '@pai/shared';

const SPARQL_BASE = process.env['WIKIDATA_SPARQL_BASE'] ?? 'https://query.wikidata.org';
const USER_AGENT = process.env['WIKIMEDIA_USER_AGENT'] ?? 'PopularityIndex/0.1.0 (contact@example.com)';

interface SparqlResult {
  results: {
    bindings: Array<{
      sitelinks?: { value: string };
      birthDate?: { value: string };
      occupationLabel?: { value: string };
      youtubeChannelId?: { value: string };
    }>;
  };
}

export class WikidataProvider implements AttentionProvider {
  readonly providerName = 'wikidata';
  readonly providerType = 'live' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const qid = input.wikidataQid;
    const query = `
      SELECT ?sitelinks ?birthDate ?occupationLabel ?youtubeChannelId WHERE {
        BIND(wd:${qid} AS ?person)
        OPTIONAL { ?person wikibase:sitelinks ?sitelinks }
        OPTIONAL { ?person wdt:P569 ?birthDate }
        OPTIONAL {
          ?person wdt:P106 ?occupation .
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
        }
        OPTIONAL { ?person wdt:P2397 ?youtubeChannelId }
      }
      LIMIT 1
    `;

    const url = `${SPARQL_BASE}/sparql?query=${encodeURIComponent(query)}&format=json`;

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/sparql-results+json',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = (await res.json()) as SparqlResult;
      const binding = data.results.bindings[0];
      const observations: RawObservation[] = [];
      const now = new Date();

      if (binding?.sitelinks) {
        const sitelinks = parseInt(binding.sitelinks.value, 10);
        if (!isNaN(sitelinks)) {
          observations.push({
            metricType: 'wikidata_sitelinks',
            metricValue: sitelinks,
            observedAt: now,
            payload: { qid },
            reliabilityScore: 0.98,
          });
        }
      }

      if (binding?.youtubeChannelId) {
        observations.push({
          metricType: 'youtube_channel_id',
          metricValue: 0,
          observedAt: now,
          payload: { channelId: binding.youtubeChannelId.value, qid },
          reliabilityScore: 0.95,
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
        errors: [{ code: 'SPARQL_ERROR', message, retryable: true }],
        fetchedAt: new Date(),
      };
    }
  }
}
