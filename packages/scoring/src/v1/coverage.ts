import type { ScoringFeatures } from '@pai/shared';

export type CoverageLabel = 'Insufficient data' | 'Partial coverage' | 'High coverage';

export interface CoverageResult {
  coverageScore: number;
  coverageLabel: CoverageLabel;
  availableSignals: string[];
  missingSignals: string[];
}

const ALL_SCORED_SIGNALS: (keyof ScoringFeatures)[] = [
  'wikipediaPageviewAverage30d',
  'wikipediaPageviewSpike7d',
  'wikipediaSitelinks',
  'searchInterestIndex',
  'searchTrendVelocity',
  'newsCoverageVolume7d',
  'newsSourceDiversity',
  'newsVelocity',
  'socialFollowerCount',
  'socialEngagementRate',
  'conversationVolume7d',
  'conversationVelocity',
  'sentimentScore',
  'controversyScore',
];

export function calculateCoverage(features: ScoringFeatures): CoverageResult {
  const available = ALL_SCORED_SIGNALS.filter(
    (s) => features[s] !== undefined && features[s] !== null,
  );

  const score = Math.round((available.length / ALL_SCORED_SIGNALS.length) * 100);

  let coverageLabel: CoverageLabel;
  if (score < 40) coverageLabel = 'Insufficient data';
  else if (score < 70) coverageLabel = 'Partial coverage';
  else coverageLabel = 'High coverage';

  return {
    coverageScore: score,
    coverageLabel,
    availableSignals: available as string[],
    missingSignals: ALL_SCORED_SIGNALS.filter((s) => !available.includes(s)) as string[],
  };
}
