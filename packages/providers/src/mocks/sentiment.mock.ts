import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';
import { seededValue } from './mock-base.js';

export class MockSentimentProvider implements AttentionProvider {
  readonly providerName = 'mock_sentiment';
  readonly providerType = 'mock' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const now = new Date();
    const id = input.personId;
    const positiveShare = seededValue(id, 'sent_pos', 0.2, 0.7);
    const negativeShare = seededValue(id, 'sent_neg', 0.05, 0.4);
    const neutralShare = Math.max(0, 1 - positiveShare - negativeShare);
    const sentimentScore = (positiveShare - negativeShare) * 100;
    return {
      providerName: this.providerName,
      providerType: this.providerType,
      success: true,
      observations: [
        {
          metricType: 'sentiment_score',
          metricValue: sentimentScore,
          observedAt: now,
          payload: { provider: 'mock', note: 'Mock data — not real sentiment analysis' },
          reliabilityScore: 0.2,
        },
        {
          metricType: 'sentiment_positive_share',
          metricValue: positiveShare,
          observedAt: now,
          payload: { provider: 'mock' },
          reliabilityScore: 0.2,
        },
        {
          metricType: 'sentiment_neutral_share',
          metricValue: neutralShare,
          observedAt: now,
          payload: { provider: 'mock' },
          reliabilityScore: 0.2,
        },
        {
          metricType: 'sentiment_negative_share',
          metricValue: negativeShare,
          observedAt: now,
          payload: { provider: 'mock' },
          reliabilityScore: 0.2,
        },
        {
          metricType: 'controversy_score',
          metricValue: seededValue(id, 'controversy', 5, 80),
          observedAt: now,
          payload: { provider: 'mock' },
          reliabilityScore: 0.2,
        },
        {
          metricType: 'sentiment_confidence',
          metricValue: 30,
          observedAt: now,
          payload: { provider: 'mock', note: 'Low confidence — mock data' },
          reliabilityScore: 0.2,
        },
      ],
      errors: [],
      fetchedAt: now,
    };
  }
}
