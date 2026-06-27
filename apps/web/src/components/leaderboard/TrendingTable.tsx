import Link from 'next/link';
import type { TrendingEntry } from '../../lib/api';

const AVATAR_COLORS = [
  'from-indigo-700 to-purple-800',
  'from-rose-700 to-red-900',
  'from-amber-600 to-orange-800',
  'from-emerald-700 to-teal-900',
  'from-sky-700 to-blue-900',
  'from-violet-700 to-purple-900',
];

function avatarGradient(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h] ?? 'from-zinc-700 to-zinc-800';
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

const PERIOD_LABEL: Record<string, string> = {
  '1h': 'last hour',
  '24h': 'last 24h',
  '30d': 'last 30 days',
};

const ACTIVITY_LABEL: Record<string, string> = {
  '1h':  'News Articles',
  '24h': 'News Articles',
  '30d': 'News Articles',
};

interface Props {
  entries: TrendingEntry[];
  timespan: '1h' | '24h' | '30d';
}

export function TrendingTable({ entries, timespan }: Props) {
  if (entries.length === 0) {
    const hint = timespan === '1h'
      ? 'The 1-hour window is narrow — try Last 24h or Last 30d for results.'
      : 'Trending data is loading. Refresh in a moment or try a wider time window.';
    return (
      <div className="text-center py-20 text-zinc-600">
        <p className="text-lg font-medium text-zinc-400">No articles found in the {PERIOD_LABEL[timespan] ?? timespan}</p>
        <p className="text-sm mt-2 text-zinc-600">{hint}</p>
      </div>
    );
  }

  const active = entries;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs text-zinc-600 uppercase tracking-wide">
            <th className="pb-3 pl-5 pr-4 w-10">#</th>
            <th className="pb-3 pr-4 py-4">Name</th>
            <th className="pb-3 pr-4 text-right">{ACTIVITY_LABEL[timespan] ?? 'Activity'}</th>
            <th className="pb-3 pr-5 text-right">Live Heat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {active.map((entry, idx) => (
            <tr key={entry.wikidataQid} className="hover:bg-zinc-800/50 transition-colors group">
              <td className="py-3 pl-5 pr-4 text-zinc-600 font-mono text-xs">{idx + 1}</td>
              <td className="py-3 pr-4">
                <Link href={`/people/${entry.wikidataQid}`} className="flex items-center gap-3">
                  {entry.photoUrl ? (
                    <img
                      src={entry.photoUrl}
                      alt={entry.displayName}
                      className="flex-shrink-0 w-9 h-9 rounded-full object-cover object-top border border-zinc-700"
                    />
                  ) : (
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(entry.displayName)} flex items-center justify-center text-white/80 text-xs font-bold`}>
                      {initials(entry.displayName)}
                    </div>
                  )}
                  <span>
                    <span className="font-semibold text-zinc-100 group-hover:text-white">{entry.displayName}</span>
                    {entry.occupationSummary && (
                      <div className="text-xs text-zinc-600 capitalize mt-0.5">{entry.occupationSummary.replace(/_/g, ' ')}</div>
                    )}
                  </span>
                </Link>
              </td>
              <td className="py-3 pr-4 text-right">
                <span className="text-lg font-bold text-red-400">
                  {timespan === '1h' && entry.articleCount > 999
                    ? `${(entry.articleCount / 1000).toFixed(0)}K`
                    : entry.articleCount}
                </span>
              </td>
              <td className="py-3 pr-5 text-right">
                <span className={`text-sm font-bold ${
                  entry.liveHeat >= 70 ? 'text-red-400' :
                  entry.liveHeat >= 40 ? 'text-orange-400' :
                  'text-amber-400'
                }`}>
                  {Math.round(entry.liveHeat)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-zinc-700 px-5 py-3">
        Source: {timespan === '1h' ? 'Google News RSS (last 75 min)' : 'GDELT news index'} · {active.length} people trending in {PERIOD_LABEL[timespan]}
      </p>
    </div>
  );
}
