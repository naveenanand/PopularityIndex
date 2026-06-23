import { describe, it, expect } from 'vitest';
import { calculatePopularityScore } from '../popularity.js';

describe('calculatePopularityScore', () => {
  it('returns 0 when no features are available', () => {
    expect(calculatePopularityScore({}).score).toBe(0);
  });

  it('returns a score between 0 and 100 for typical values', () => {
    const result = calculatePopularityScore({
      searchInterestIndex: 60,
      wikipediaPageviewAverage30d: 10_000,
      newsCoverageVolume7d: 50,
      socialFollowerCount: 5_000_000,
      conversationVolume7d: 1000,
      wikipediaSitelinks: 60,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('never returns more than 100 even for extreme values', () => {
    const result = calculatePopularityScore({
      searchInterestIndex: 100,
      searchTrendVelocity: 10,
      wikipediaPageviewAverage30d: 10_000_000,
      newsCoverageVolume7d: 10_000,
      newsSourceDiversity: 1.0,
      socialFollowerCount: 1_000_000_000,
      socialEngagementRate: 1.0,
      conversationVolume7d: 10_000_000,
      conversationVelocity: 10,
      wikipediaSitelinks: 300,
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('re-normalization means a single strong signal can produce a high score', () => {
    // Only Wikipedia pageviews, extremely high
    const withOnly = calculatePopularityScore({
      wikipediaPageviewAverage30d: 5_000_000,
    });
    // Score should be significant (all weight goes to this one signal)
    expect(withOnly.score).toBeGreaterThan(50);
  });
});
