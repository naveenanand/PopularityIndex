import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';
import { seededValue } from './mock-base.js';

export class MockSearchInterestProvider implements AttentionProvider {
  readonly providerName = 'mock_search_interest';
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
          metricType: 'search_interest_index',
          metricValue: seededValue(id, 'search_idx', 5, 95),
          observedAt: now,
          payload: { provider: 'mock', note: 'Mock data — not real search interest' },
          reliabilityScore: 0.3,
        },
        {
          metricType: 'search_trend_velocity',
          metricValue: seededValue(id, 'search_vel', -0.5, 0.8),
          observedAt: now,
          payload: { provider: 'mock' },
          reliabilityScore: 0.3,
        },
        {
          metricType: 'search_spike',
          metricValue: seededValue(id, 'search_spike', 0.8, 3.0),
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
