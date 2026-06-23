import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';
import { seededValue } from './mock-base.js';

export class MockSocialReachProvider implements AttentionProvider {
  readonly providerName = 'mock_social_reach';
  readonly providerType = 'mock' as const;

  async getObservations(input: ProviderRequest): Promise<ProviderResult> {
    const now = new Date();
    const id = input.personId;
    // Log-scale follower counts: 10^6 to 10^8.5
    const logFollowers = seededValue(id, 'social_followers', 6, 8.5);
    const followers = Math.round(Math.pow(10, logFollowers));
    return {
      providerName: this.providerName,
      providerType: this.providerType,
      success: true,
      observations: [
        {
          metricType: 'social_follower_count',
          metricValue: followers,
          observedAt: now,
          payload: { provider: 'mock', note: 'Mock data — not real follower counts' },
          reliabilityScore: 0.3,
        },
        {
          metricType: 'social_engagement_rate',
          metricValue: seededValue(id, 'social_eng', 0.005, 0.08),
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
