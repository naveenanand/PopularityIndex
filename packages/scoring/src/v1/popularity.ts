import type { ScoringFeatures } from '@pai/shared';
import { clamp, log10Scale } from '@pai/shared';
import { renormalizeAndScore, type WeightedSignal } from '../normalizer.js';

const WEIGHTS = {
  searchInterest: 0.15,
  wikipediaAttention: 0.15,
  qualityMedia: 0.25,
  socialReach: 0.15,
  conversation: 0.15,
  enduringProminence: 0.15,
};

export function componentSearchInterest(f: ScoringFeatures): number | undefined {
  if (f.searchInterestIndex === undefined) return undefined;
  const velocityBoost = clamp((f.searchTrendVelocity ?? 0) * 10, 0, 15);
  return clamp(f.searchInterestIndex + velocityBoost, 0, 100);
}

export function componentWikipediaAttention(f: ScoringFeatures): number | undefined {
  if (f.wikipediaPageviewAverage30d === undefined) return undefined;
  // log10 scale: 100 = 1M+ daily views
  return log10Scale(f.wikipediaPageviewAverage30d, 1_000_000);
}

export function componentQualityMedia(f: ScoringFeatures): number | undefined {
  if (f.newsCoverageVolume7d === undefined) return undefined;
  const volumeScore = clamp((f.newsCoverageVolume7d / 500) * 80, 0, 80);
  const diversityBoost = (f.newsSourceDiversity ?? 0.5) * 20;
  return clamp(volumeScore + diversityBoost, 0, 100);
}

export function componentSocialReach(f: ScoringFeatures): number | undefined {
  if (f.socialFollowerCount === undefined) return undefined;
  // log10 scale: 100 = 100M+ followers
  const base = log10Scale(f.socialFollowerCount, 100_000_000);
  const engagementBoost = clamp((f.socialEngagementRate ?? 0) * 100, 0, 10);
  return clamp(base + engagementBoost, 0, 100);
}

export function componentConversation(f: ScoringFeatures): number | undefined {
  if (f.conversationVolume7d === undefined) return undefined;
  const volumeScore = clamp((f.conversationVolume7d / 10_000) * 90, 0, 90);
  const velocityBoost = clamp(((f.conversationVelocity ?? 1) - 1) * 5, 0, 10);
  return clamp(volumeScore + velocityBoost, 0, 100);
}

export function componentEnduringProminence(f: ScoringFeatures): number | undefined {
  if (f.wikipediaSitelinks === undefined) return undefined;
  // 100+ language editions = maximum score
  return clamp((f.wikipediaSitelinks / 100) * 100, 0, 100);
}

export interface PopularityResult {
  score: number;
  componentScores: Record<string, number | undefined>;
}

export function calculatePopularityScore(features: ScoringFeatures): PopularityResult {
  const componentScores = {
    searchInterest: componentSearchInterest(features),
    wikipediaAttention: componentWikipediaAttention(features),
    qualityMedia: componentQualityMedia(features),
    socialReach: componentSocialReach(features),
    conversation: componentConversation(features),
    enduringProminence: componentEnduringProminence(features),
  };

  const signals: WeightedSignal[] = Object.entries(componentScores).map(([name, value]) => ({
    name,
    weight: WEIGHTS[name as keyof typeof WEIGHTS],
    value,
  }));

  return {
    score: Math.round(renormalizeAndScore(signals) * 10) / 10,
    componentScores,
  };
}
