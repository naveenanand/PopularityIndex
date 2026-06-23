export function log10Scale(value: number, maxValue: number): number {
  if (value <= 0) return 0;
  const logVal = Math.log10(Math.max(1, value));
  const logMax = Math.log10(Math.max(1, maxValue));
  return Math.min(100, (logVal / logMax) * 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function safeRatio(numerator: number, denominator: number): number {
  const safeDenominator = Math.max(1, denominator);
  return numerator / safeDenominator;
}
