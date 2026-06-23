import type { ScoringFeatures } from '@pai/shared';
import { clamp } from '@pai/shared';
import { renormalizeAndScore, type WeightedSignal } from '../normalizer.js';

const HEAT_WEIGHTS = {
  searchSpike: 0.3,
  pageviewSpike: 0.25,
  mediaCoverageVelocity: 0.25,
  socialVelocity: 0.2,
};

// Converts a spike ratio into a 0–100 score.
// ratio = 1.0 → no change → 0; ratio = 50x spike → 100
function spikeScore(ratio: number): number {
  if (ratio <= 1.0) return 0;
  return clamp((Math.log10(ratio) / Math.log10(50)) * 100, 0, 100);
}

function componentSearchSpike(f: ScoringFeatures): number | undefined {
  if (f.searchSpike === undefined) return undefined;
  return spikeScore(f.searchSpike);
}

function componentPageviewSpike(f: ScoringFeatures): number | undefined {
  if (f.wikipediaPageviewSpike7d === undefined) return undefined;
  return spikeScore(f.wikipediaPageviewSpike7d);
}

function componentMediaVelocity(f: ScoringFeatures): number | undefined {
  if (f.newsVelocity === undefined) return undefined;
  return spikeScore(f.newsVelocity);
}

function componentSocialVelocity(f: ScoringFeatures): number | undefined {
  if (f.conversationVelocity === undefined) return undefined;
  return spikeScore(f.conversationVelocity);
}

export interface HeatResult {
  score: number;
  componentScores: Record<string, number | undefined>;
}

export function calculateHeatScore(features: ScoringFeatures): HeatResult {
  const componentScores = {
    searchSpike: componentSearchSpike(features),
    pageviewSpike: componentPageviewSpike(features),
    mediaCoverageVelocity: componentMediaVelocity(features),
    socialVelocity: componentSocialVelocity(features),
  };

  const signals: WeightedSignal[] = Object.entries(componentScores).map(([name, value]) => ({
    name,
    weight: HEAT_WEIGHTS[name as keyof typeof HEAT_WEIGHTS],
    value,
  }));

  return {
    score: Math.round(renormalizeAndScore(signals) * 10) / 10,
    componentScores,
  };
}
