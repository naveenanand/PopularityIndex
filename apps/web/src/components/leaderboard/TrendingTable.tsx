import Link from 'next/link';
import type { TrendingEntry } from '../../lib/api';

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500',
  'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-blue-500',
];

function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h] ?? 'bg-indigo-500';
}

const PERIOD_LABEL: Record<string, string> = {
  '1h': 'last hour',
  '24h': 'last 24h',
  '30d': 'last 30 days',
};

interface Props {
  entries: TrendingEntry[];
  timespan: '1h' | '24h' | '30d';
}

export function TrendingTable({ entries, timespan }: Props) {
  if (entries.length === 0 || entries.every(e => e.articleCount === 0)) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg font-medium">No trending activity detected</p>
        <p className="text-sm mt-2 text-gray-400">
          No news articles found in the {PERIOD_LABEL[timespan] ?? timespan} for tracked people.
        </p>
      </div>
    );
  }

  const active = entries.filter(e => e.articleCount > 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-3 pr-4 w-10">#</th>
            <th className="pb-3 pr-4">Name</th>
            <th className="pb-3 pr-4 text-right">Articles ({PERIOD_LABEL[timespan]})</th>
            <th className="pb-3 text-right">Popularity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {active.map((entry, idx) => (
            <tr key={entry.wikidataQid} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 pr-4 text-gray-400 font-mono text-xs">{idx + 1}</td>
              <td className="py-3 pr-4">
                <Link href={`/people/${entry.wikidataQid}`} className="flex items-center gap-2.5 group">
                  {entry.photoUrl ? (
                    <img
                      src={entry.photoUrl}
                      alt={entry.displayName}
                      className="flex-shrink-0 w-8 h-8 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <span className={`flex-shrink-0 w-8 h-8 rounded-full ${avatarColor(entry.displayName)} flex items-center justify-center text-white text-xs font-semibold`}>
                      {initials(entry.displayName)}
                    </span>
                  )}
                  <span>
                    <span className="font-medium text-gray-900 group-hover:text-indigo-600">
                      {entry.displayName}
                    </span>
                    {entry.occupationSummary && (
                      <div className="text-xs text-gray-400 capitalize mt-0.5">
                        {entry.occupationSummary.replace(/_/g, ' ')}
                      </div>
                    )}
                  </span>
                </Link>
              </td>
              <td className="py-3 pr-4 text-right">
                <span className="text-lg font-bold text-rose-500">{entry.articleCount}</span>
              </td>
              <td className="py-3 text-right">
                <span className="text-sm font-semibold text-indigo-600">{Math.round(entry.popularityScore)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-300 mt-4">Source: GDELT Project · {active.length} people with coverage in {PERIOD_LABEL[timespan]}</p>
    </div>
  );
}
