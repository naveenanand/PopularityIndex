import Link from 'next/link';
import type { LeaderboardEntry } from '../../lib/api';
import { formatScore, coverageBadgeColor } from '../../lib/formatters';

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

interface Props {
  entries: LeaderboardEntry[];
  startRank?: number;
}

export function LeaderboardTable({ entries, startRank = 1 }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-20 text-zinc-600">
        <p className="text-lg font-medium text-zinc-400">No scores available yet</p>
        <p className="text-sm mt-2">
          Run{' '}
          <code className="bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-xs text-zinc-300">
            pnpm score:calculate
          </code>{' '}
          to generate scores.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs text-zinc-600 uppercase tracking-wide">
            <th className="pb-3 pl-5 pr-4 w-10">#</th>
            <th className="pb-3 pr-4 py-4">Name</th>
            <th className="pb-3 pr-4 text-right">Popularity</th>
            <th className="pb-3 pr-4 text-right">Heat</th>
            <th className="pb-3 pr-5">Coverage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {entries.map((entry) => {
            const rank = startRank + entries.indexOf(entry);
            return (
              <tr key={entry.wikidataQid} className="hover:bg-zinc-800/50 transition-colors group">
                <td className="py-3 pl-5 pr-4 text-zinc-600 font-mono text-xs">{rank}</td>
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
                      <span className="font-semibold text-zinc-100 group-hover:text-white transition-colors">
                        {entry.displayName}
                      </span>
                      {entry.occupationSummary && (
                        <div className="text-xs text-zinc-600 capitalize mt-0.5">
                          {entry.occupationSummary.replace(/_/g, ' ')}
                        </div>
                      )}
                    </span>
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-base font-bold text-amber-400">
                    {formatScore(entry.popularityScore)}
                  </span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="text-base font-bold text-orange-400">
                    {formatScore(entry.heatScore)}
                  </span>
                </td>
                <td className="py-3 pr-5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${coverageBadgeColor(entry.coverageLabel)}`}>
                    {entry.coverageLabel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
