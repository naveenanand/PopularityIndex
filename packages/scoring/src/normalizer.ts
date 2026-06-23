export interface WeightedSignal {
  name: string;
  weight: number;
  value: number | undefined;
}

// Re-normalize available signals so missing signals don't drag the score down.
// Formula: Σ(value_i × weight_i) / Σ(weight_i for available signals)
export function renormalizeAndScore(signals: WeightedSignal[]): number {
  const available = signals.filter((s) => s.value !== undefined);

  if (available.length === 0) return 0;

  const totalAvailableWeight = available.reduce((sum, s) => sum + s.weight, 0);
  if (totalAvailableWeight === 0) return 0;

  return available.reduce((sum, s) => {
    const renormalizedWeight = s.weight / totalAvailableWeight;
    return sum + (s.value! * renormalizedWeight);
  }, 0);
}
