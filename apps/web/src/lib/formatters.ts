export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

export function coverageBadgeColor(label: string): string {
  if (label === 'High coverage') return 'bg-green-100 text-green-800 border-green-200';
  if (label === 'Partial coverage') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-gray-100 text-gray-500 border-gray-200';
}

export function providerBadgeColor(type: 'live' | 'mock' | 'unavailable'): string {
  if (type === 'live') return 'bg-green-100 text-green-700 border-green-200';
  if (type === 'mock') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-gray-100 text-gray-400 border-gray-200';
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-gray-500';
}
