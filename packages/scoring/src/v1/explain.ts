import type { ScoringFeatures, ScoreExplanation, TopContributor } from '@pai/shared';
import type { PopularityResult } from './popularity.js';
import type { HeatResult } from './heat.js';
import type { CoverageResult } from './coverage.js';

const SIGNAL_LABELS: Record<string, { label: string; providerType: 'live' | 'mock' | 'unavailable' }> = {
  wikipediaAttention: { label: 'Wikipedia pageviews', providerType: 'live' },
  enduringProminence: { label: 'Wikipedia language editions', providerType: 'live' },
  searchInterest: { label: 'Search interest', providerType: 'mock' },
  qualityMedia: { label: 'News coverage', providerType: 'mock' },
  socialReach: { label: 'Social reach', providerType: 'mock' },
  conversation: { label: 'Social conversation', providerType: 'mock' },
  pageviewSpike: { label: 'Wikipedia pageview spike', providerType: 'live' },
  searchSpike: { label: 'Search spike', providerType: 'mock' },
  mediaCoverageVelocity: { label: 'News velocity', providerType: 'mock' },
  socialVelocity: { label: 'Social velocity', providerType: 'mock' },
};

function reasonFor(signal: string, features: ScoringFeatures, score: number): string {
  switch (signal) {
    case 'wikipediaAttention':
      return `Wikipedia averaged ${Math.round(features.wikipediaPageviewAverage30d ?? 0).toLocaleString()} daily views (30-day)`;
    case 'enduringProminence':
      return `${features.wikipediaSitelinks ?? 0} Wikipedia language editions`;
    case 'searchInterest':
      return `Search interest index: ${Math.round(features.searchInterestIndex ?? 0)}/100 (mock data)`;
    case 'qualityMedia':
      return `${Math.round(features.newsCoverageVolume7d ?? 0)} news articles in last 7 days (mock data)`;
    case 'socialReach':
      return `Estimated ${Math.round((features.socialFollowerCount ?? 0) / 1_000_000)}M social followers (mock data)`;
    case 'conversation':
      return `${Math.round(features.conversationVolume7d ?? 0).toLocaleString()} social mentions in last 7 days (mock data)`;
    case 'pageviewSpike':
      return `Wikipedia views spiked ${Math.round((features.wikipediaPageviewSpike7d ?? 1) * 10) / 10}× vs 90-day baseline`;
    case 'searchSpike':
      return `Search interest spiked ${Math.round((features.searchSpike ?? 1) * 10) / 10}× vs baseline (mock data)`;
    case 'mediaCoverageVelocity':
      return `News coverage velocity: ${Math.round((features.newsVelocity ?? 1) * 10) / 10}× baseline (mock data)`;
    case 'socialVelocity':
      return `Conversation velocity: ${Math.round((features.conversationVelocity ?? 1) * 10) / 10}× baseline (mock data)`;
    default:
      return `Score contribution: ${Math.round(score * 10) / 10}`;
  }
}

export function generateExplanation(
  features: ScoringFeatures,
  popularity: PopularityResult,
  heat: HeatResult,
  coverage: CoverageResult,
): ScoreExplanation {
  // Collect all component contributions
  const contributions: Array<{ signal: string; impact: number }> = [];

  for (const [signal, score] of Object.entries(popularity.componentScores)) {
    if (score !== undefined) {
      contributions.push({ signal, impact: score });
    }
  }

  for (const [signal, score] of Object.entries(heat.componentScores)) {
    if (score !== undefined) {
      contributions.push({ signal, impact: score });
    }
  }

  // Sort by impact descending, take top 5
  contributions.sort((a, b) => b.impact - a.impact);
  const top = contributions.slice(0, 5);

  const topContributors: TopContributor[] = top.map(({ signal, impact }) => {
    const meta = SIGNAL_LABELS[signal] ?? { label: signal, providerType: 'unavailable' as const };
    return {
      signal: meta.label,
      impact: `+${Math.round(impact * 10) / 10}`,
      reason: reasonFor(signal, features, impact),
      provider_type: meta.providerType,
    };
  });

  return {
    score_model_version: 'v1',
    popularity_score: popularity.score,
    heat_score: heat.score,
    coverage_score: coverage.coverageScore,
    coverage_label: coverage.coverageLabel,
    top_contributors: topContributors,
    signals_available: coverage.availableSignals,
    signals_missing: coverage.missingSignals,
  };
}
