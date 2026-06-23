import type { ScoringFeatures } from '@pai/shared';
import { clamp } from '@pai/shared';

export interface SentimentResult {
  sentimentScore: number;
  positiveShare: number;
  neutralShare: number;
  negativeShare: number;
  controversyScore: number;
  sentimentConfidence: number;
}

// Sentiment is calculated and stored separately — it is NEVER used in Popularity or Heat.
export function calculateSentiment(features: ScoringFeatures): SentimentResult | null {
  if (features.sentimentScore === undefined) return null;
  return {
    sentimentScore: clamp(features.sentimentScore, -100, 100),
    positiveShare: clamp(features.sentimentPositiveShare ?? 0, 0, 1),
    neutralShare: clamp(features.sentimentNeutralShare ?? 0, 0, 1),
    negativeShare: clamp(features.sentimentNegativeShare ?? 0, 0, 1),
    controversyScore: clamp(features.controversyScore ?? 0, 0, 100),
    sentimentConfidence: clamp(features.sentimentConfidence ?? 30, 0, 100),
  };
}
