import type { AttentionProvider, ProviderRequest, ProviderResult } from '@pai/shared';
import { seededValue } from './mock-base.js';

export class MockConversationProvider implements AttentionProvider {
  readonly providerName = 'mock_conversation';
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
          metricType: 'conversation_volume_7d',
          metricValue: Math.round(seededValue(id, 'conv_vol', 100, 50000)),
          observedAt: now,
          payload: { provider: 'mock', note: 'Mock data — not real conversation volume' },
          reliabilityScore: 0.3,
        },
        {
          metricType: 'conversation_velocity',
          metricValue: seededValue(id, 'conv_vel', 0.5, 5.0),
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
