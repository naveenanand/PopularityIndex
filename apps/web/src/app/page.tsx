import Link from 'next/link';
import { getLeaderboard } from '../lib/api.js';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable.js';
import { SearchBar } from '../components/shared/SearchBar.js';

type SearchParams = Promise<{ sort?: string }>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { sort } = await searchParams;
  const sortBy = sort === 'heat' ? 'heat' : 'popularity';
  const entries = await getLeaderboard(sortBy, 100);

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

      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500">Sort by:</span>
        <Link
          href="/?sort=popularity"
          className={`px-3 py-1 rounded-full border transition-colors ${
            sortBy === 'popularity'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'text-gray-600 border-gray-300 hover:border-indigo-400'
          }`}
        >
          Popularity
        </Link>
        <Link
          href="/?sort=heat"
          className={`px-3 py-1 rounded-full border transition-colors ${
            sortBy === 'heat'
              ? 'bg-amber-500 text-white border-amber-500'
              : 'text-gray-600 border-gray-300 hover:border-amber-400'
          }`}
        >
          Heat (trending)
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <LeaderboardTable entries={entries} />
      </div>

      <p className="text-xs text-gray-400 text-center">
        Scores updated daily. Live data: Wikipedia, Wikidata. Mock data: Search, News, Social
        (labeled per signal).
      </p>
    </div>
  );
}
