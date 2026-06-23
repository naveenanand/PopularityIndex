import type { ScoringFeatures, ScoreExplanation } from '@pai/shared';
import { calculatePopularityScore } from './v1/popularity.js';
import { calculateHeatScore } from './v1/heat.js';
import { calculateSentiment } from './v1/sentiment.js';
import { calculateCoverage } from './v1/coverage.js';
import { generateExplanation } from './v1/explain.js';
import { clamp } from '@pai/shared';

export const SCORE_MODEL_VERSION = 'v1';

export interface ScoreEngineInput {
  personId: number;
  features: ScoringFeatures;
}

export interface ScoreEngineOutput {
  popularityScore: number;
  heatScore: number;
  sentimentScore: number | null;
  controversyScore: number | null;
  coverageScore: number;
  confidenceScore: number;
  scoreModelVersion: string;
  explanationJson: ScoreExplanation;
}

export function calculateScores(input: ScoreEngineInput): ScoreEngineOutput {
  const { features } = input;

  const popularity = calculatePopularityScore(features);
  const heat = calculateHeatScore(features);
  const sentiment = calculateSentiment(features);
  const coverage = calculateCoverage(features);
  const explanation = generateExplanation(features, popularity, heat, coverage);

  // Confidence = coverage × fraction of live signals
  // In MVP, only Wikipedia/Wikidata signals are live
  const liveSignals = ['wikipediaPageviewAverage30d', 'wikipediaSitelinks', 'wikipediaLanguageEditions'];
  const availableLive = liveSignals.filter(
    (s) => features[s as keyof ScoringFeatures] !== undefined,
  );
  const liveRatio = coverage.availableSignals.length > 0
    ? availableLive.length / coverage.availableSignals.length
    : 0;
  const confidenceScore = clamp(coverage.coverageScore * liveRatio, 0, 100);

  return {
    popularityScore: clamp(popularity.score, 0, 100),
    heatScore: clamp(heat.score, 0, 100),
    sentimentScore: sentiment?.sentimentScore ?? null,
    controversyScore: sentiment?.controversyScore ?? null,
    coverageScore: coverage.coverageScore,
    confidenceScore: Math.round(confidenceScore),
    scoreModelVersion: SCORE_MODEL_VERSION,
    explanationJson: explanation,
  };
}
