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
  if (label === 'High coverage') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (label === 'Partial coverage') return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
  return 'bg-zinc-800 text-zinc-500 border-zinc-700';
}

export function providerBadgeColor(type: 'live' | 'mock' | 'unavailable' | 'partial'): string {
  if (type === 'live') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  if (type === 'mock') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  if (type === 'partial') return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
  return 'bg-zinc-800 text-zinc-600 border-zinc-700';
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-zinc-500';
}
