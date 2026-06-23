import Link from 'next/link';
import type { LeaderboardEntry } from '../../lib/api.js';
import { formatScore, coverageBadgeColor } from '../../lib/formatters.js';

interface Props {
  entries: LeaderboardEntry[];
}

export function LeaderboardTable({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg font-medium">No scores available yet</p>
        <p className="text-sm mt-2">
          Run{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">
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
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="pb-3 pr-4 w-10">#</th>
            <th className="pb-3 pr-4">Name</th>
            <th className="pb-3 pr-4 text-right">Popularity</th>
            <th className="pb-3 pr-4 text-right">Heat</th>
            <th className="pb-3">Coverage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <tr key={entry.wikidataQid} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 pr-4 text-gray-400 font-mono text-xs">{entry.rank}</td>
              <td className="py-3 pr-4">
                <Link
                  href={`/people/${entry.wikidataQid}`}
                  className="font-medium text-gray-900 hover:text-indigo-600"
                >
                  {entry.displayName}
                </Link>
                {entry.occupationSummary && (
                  <div className="text-xs text-gray-400 capitalize mt-0.5">
                    {entry.occupationSummary.replace(/_/g, ' ')}
                  </div>
                )}
              </td>
              <td className="py-3 pr-4 text-right">
                <span className="text-lg font-bold text-indigo-600">
                  {formatScore(entry.popularityScore)}
                </span>
              </td>
              <td className="py-3 pr-4 text-right">
                <span className="text-lg font-bold text-amber-500">
                  {formatScore(entry.heatScore)}
                </span>
              </td>
              <td className="py-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs border ${coverageBadgeColor(entry.coverageLabel)}`}
                >
                  {entry.coverageLabel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
