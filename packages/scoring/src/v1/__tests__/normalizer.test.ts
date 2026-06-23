import { describe, it, expect } from 'vitest';
import { renormalizeAndScore } from '../../normalizer.js';

describe('renormalizeAndScore', () => {
  it('returns 0 when all signals are missing', () => {
    expect(
      renormalizeAndScore([
        { name: 'a', weight: 0.5, value: undefined },
        { name: 'b', weight: 0.5, value: undefined },
      ]),
    ).toBe(0);
  });

  it('returns the full value when only one signal is available', () => {
    const result = renormalizeAndScore([
      { name: 'a', weight: 0.4, value: 80 },
      { name: 'b', weight: 0.6, value: undefined },
    ]);
    expect(result).toBeCloseTo(80, 5);
  });

  it('re-normalizes correctly with two signals', () => {
    const result = renormalizeAndScore([
      { name: 'a', weight: 0.5, value: 100 },
      { name: 'b', weight: 0.5, value: 60 },
    ]);
    expect(result).toBeCloseTo(80, 5);
  });

  it('never reduces score when a signal is missing', () => {
    const full = renormalizeAndScore([
      { name: 'a', weight: 0.5, value: 90 },
      { name: 'b', weight: 0.5, value: 90 },
    ]);
    const partial = renormalizeAndScore([
      { name: 'a', weight: 0.5, value: 90 },
      { name: 'b', weight: 0.5, value: undefined },
    ]);
    // partial should equal full since re-normalization gives b's weight to a
    expect(partial).toBeCloseTo(full, 5);
  });

  it('handles zero-weight signals gracefully', () => {
    expect(
      renormalizeAndScore([{ name: 'a', weight: 0, value: 50 }]),
    ).toBe(0);
  });
});
