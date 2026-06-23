import { describe, it, expect } from 'vitest';
import { calculateHeatScore } from '../heat.js';

describe('calculateHeatScore', () => {
  it('returns 0 when no spike signals are present', () => {
    expect(calculateHeatScore({}).score).toBe(0);
  });

  it('returns a positive score when spikes are present', () => {
    const result = calculateHeatScore({
      wikipediaPageviewSpike7d: 5,
      searchSpike: 3,
      newsVelocity: 2,
      conversationVelocity: 2,
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('caps at 100 for extreme spike values', () => {
    const result = calculateHeatScore({
      wikipediaPageviewSpike7d: 10_000,
      searchSpike: 10_000,
      newsVelocity: 10_000,
      conversationVelocity: 10_000,
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns 0 for spike ratio of exactly 1 (no change)', () => {
    const result = calculateHeatScore({
      wikipediaPageviewSpike7d: 1,
    });
    // log10(1) = 0, so component is 0
    expect(result.score).toBe(0);
  });

  it('detects negative momentum (spike < 1) and scores low', () => {
    const result = calculateHeatScore({
      wikipediaPageviewSpike7d: 0.3,
    });
    // spike below 1 means log is negative, clamped to 0
    expect(result.score).toBe(0);
  });
});
