import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';
import { seededValue } from './mock-base.js';

export class MockNewsCoverageProvider implements AttentionProvider {
  readonly providerName = 'mock_news_coverage';
  readonly providerType = 'mock' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const now = new Date();
    const id = input.personId;
    return {
      providerName: this.providerName,
      providerType: this.providerType,
      success: true,
      observations: [
        {
          metricType: 'news_article_count_7d',
          metricValue: Math.round(seededValue(id, 'news_vol', 0, 400)),
          observedAt: now,
          payload: { provider: 'mock', note: 'Mock data — not real news coverage' },
          reliabilityScore: 0.3,
        },
        {
          metricType: 'news_source_diversity',
          metricValue: seededValue(id, 'news_div', 0.1, 0.95),
          observedAt: now,
          payload: { provider: 'mock' },
          reliabilityScore: 0.3,
        },
        {
          metricType: 'news_velocity',
          metricValue: seededValue(id, 'news_vel', 0.5, 4.0),
          observedAt: now,
          payload: { provider: 'mock' },
          reliabilityScore: 0.3,
        },
      ],
      errors: [],
      fetchedAt: now,
    };
  }
}
