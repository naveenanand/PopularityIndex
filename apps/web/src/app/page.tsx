export const revalidate = 300; // 5 min — covers the trending tabs' live GDELT queries

import Link from 'next/link';
import { getLeaderboard, getTrendingLeaderboard } from '../lib/api';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { TrendingTable } from '../components/leaderboard/TrendingTable';
import { SearchBar } from '../components/shared/SearchBar';

type SearchParams = Promise<{ sort?: string }>;

const TABS = [
  { key: 'popularity', label: 'All Time' },
  { key: 'heat', label: 'Heat' },
  { key: 'trending_1h', label: 'Last Hour' },
  { key: 'trending_24h', label: 'Last 24h' },
  { key: 'trending_30d', label: 'Last 30d' },
] as const;

type SortKey = typeof TABS[number]['key'];

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { sort } = await searchParams;
  const sortKey: SortKey = (TABS.find(t => t.key === sort)?.key) ?? 'popularity';

  const isTrending = sortKey.startsWith('trending_');
  const timespanMap = { trending_1h: '1h', trending_24h: '24h', trending_30d: '30d' } as const;

  const [entries, trendingEntries] = await Promise.all([
    !isTrending ? getLeaderboard(sortKey === 'heat' ? 'heat' : 'popularity', 100) : Promise.resolve([]),
    isTrending ? getTrendingLeaderboard(timespanMap[sortKey as keyof typeof timespanMap], 50) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Public Attention Index</h1>
          <p className="text-gray-500 text-sm mt-1">
            Transparent attention scores for public figures. Wikipedia-sourced, methodology published.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <SearchBar placeholder="Find a person..." />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        {TABS.map(tab => {
          const active = sortKey === tab.key;
          const isTrendingTab = tab.key.startsWith('trending_');
          return (
            <Link
              key={tab.key}
              href={`/?sort=${tab.key}`}
              className={`px-3 py-1.5 rounded-full border transition-colors font-medium ${
                active
                  ? isTrendingTab
                    ? 'bg-rose-500 text-white border-rose-500'
                    : tab.key === 'heat'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-indigo-600 text-white border-indigo-600'
                  : 'text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {isTrendingTab && <span className="mr-1">🔥</span>}
              {tab.label}
            </Link>
          );
        })}
        {isTrending && (
          <span className="text-xs text-gray-400 ml-2">Live · refreshes every 5 min</span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {isTrending
          ? <TrendingTable entries={trendingEntries} timespan={timespanMap[sortKey as keyof typeof timespanMap]} />
          : <LeaderboardTable entries={entries} />
        }
      </div>

      <p className="text-xs text-gray-400 text-center">
        Scores updated every 2 hours. Trending tabs show live GDELT news article counts.
      </p>
    </div>
  );
}
