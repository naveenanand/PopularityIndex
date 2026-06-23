import { describe, it, expect } from 'vitest';
import { calculateCoverage } from '../coverage.js';
import type { ScoringFeatures } from '@pai/shared';

describe('calculateCoverage', () => {
  it('returns Insufficient data when no signals are present', () => {
    const result = calculateCoverage({});
    expect(result.coverageScore).toBe(0);
    expect(result.coverageLabel).toBe('Insufficient data');
    expect(result.availableSignals).toHaveLength(0);
  });

  it('returns Partial coverage when 40–69% signals are available', () => {
    const features: ScoringFeatures = {
      searchInterestIndex: 50,
      wikipediaPageviewAverage30d: 1000,
      newsCoverageVolume7d: 10,
      socialFollowerCount: 1_000_000,
      conversationVolume7d: 500,
      wikipediaSitelinks: 30,
      wikipediaPageviewSpike7d: 1.5,
    };
    const result = calculateCoverage(features);
    expect(result.coverageLabel).toBe('Partial coverage');
    expect(result.coverageScore).toBeGreaterThanOrEqual(40);
    expect(result.coverageScore).toBeLessThan(70);
  });

  it('returns High coverage when ≥70% signals are present', () => {
    const features: ScoringFeatures = {
      searchInterestIndex: 60,
      searchTrendVelocity: 1.2,
      searchSpike: 2.0,
      wikipediaPageviewAverage30d: 5000,
      wikipediaPageviewSpike7d: 3.0,
      newsCoverageVolume7d: 50,
      newsSourceDiversity: 0.7,
      newsVelocity: 1.5,
      socialFollowerCount: 10_000_000,
      socialEngagementRate: 0.03,
      conversationVolume7d: 2000,
      conversationVelocity: 1.8,
      wikipediaSitelinks: 80,
    };
    const result = calculateCoverage(features);
    expect(result.coverageLabel).toBe('High coverage');
    expect(result.coverageScore).toBeGreaterThanOrEqual(70);
  });

  it('lists missing signals', () => {
    const result = calculateCoverage({ searchInterestIndex: 50 });
    expect(result.missingSignals.length).toBeGreaterThan(0);
    expect(result.availableSignals).toContain('searchInterestIndex');
  });
});
