export const revalidate = 60;

import Link from 'next/link';
import { getLeaderboard, getTrendingLeaderboard, getNewsFeed } from '../lib/api';
import { HeroSection } from '../components/home/HeroSection';
import { PersonCarousel } from '../components/home/PersonCarousel';
import { NewsFeedSection } from '../components/home/NewsFeedSection';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { TrendingTable } from '../components/leaderboard/TrendingTable';

type SearchParams = Promise<{ sort?: string; page?: string }>;

const TABS = [
  { key: 'popularity', label: 'All Time' },
  { key: 'heat', label: '🌡️ Heat' },
  { key: 'trending_1h', label: '🔥 Last Hour' },
  { key: 'trending_24h', label: '🔥 Last 24h' },
  { key: 'trending_30d', label: '🔥 Last 30d' },
] as const;

type SortKey = typeof TABS[number]['key'];
const PAGE_SIZE = 100;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { sort, page } = await searchParams;
  const sortKey: SortKey = (TABS.find(t => t.key === sort)?.key) ?? 'popularity';
  const currentPage = Math.max(1, parseInt(page ?? '1', 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const isTrending = sortKey.startsWith('trending_');
  const isDefaultView = sortKey === 'popularity' && currentPage === 1;
  const timespanMap = { trending_1h: '1h', trending_24h: '24h', trending_30d: '30d' } as const;

  // Load data depending on active tab
  const [entries, trendingEntries, newsFeed] = await Promise.all([
    !isTrending ? getLeaderboard(sortKey === 'heat' ? 'heat' : 'popularity', PAGE_SIZE, offset) : Promise.resolve([]),
    isTrending ? getTrendingLeaderboard(timespanMap[sortKey as keyof typeof timespanMap], 50) : Promise.resolve([]),
    isDefaultView ? getNewsFeed() : Promise.resolve([]),
  ]);

  const hasNextPage = !isTrending && entries.length === PAGE_SIZE;
  const hasPrevPage = currentPage > 1;

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (sortKey !== 'popularity') params.set('sort', sortKey);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  }

  const hero = entries[0];

  return (
    <div className="space-y-0 pb-16">
      {/* Netflix-style hero — only on default view */}
      {isDefaultView && hero && (
        <HeroSection person={hero} />
      )}

      {/* Tab bar */}
      <div className="sticky top-16 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => {
            const active = sortKey === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/?sort=${tab.key}`}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  active
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
          {isTrending && (
            <span className="text-xs text-zinc-600 ml-2 flex-shrink-0">Live GDELT · refreshes every 5 min</span>
          )}
        </div>
      </div>

      {/* Main content area */}
      {isDefaultView ? (
        // Netflix-style carousels for default view
        <div className="space-y-10 pt-10">
          {/* Most Popular carousel */}
          <PersonCarousel
            title="Most Popular All Time"
            icon="⭐"
            entries={entries}
            seeAllHref="/?sort=popularity&page=2"
          />

          {/* Top 10 grid with ranks */}
          <section className="px-6 sm:px-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Top 10 Ranked</h2>
              <span className="text-xs text-zinc-600">Updated every 60s</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {entries.slice(0, 10).map((entry, idx) => (
                <Link
                  key={entry.wikidataQid}
                  href={`/people/${entry.wikidataQid}`}
                  className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all group"
                >
                  <span className="text-4xl font-black text-zinc-700 w-10 flex-shrink-0 leading-none">
                    {idx + 1}
                  </span>
                  {entry.photoUrl ? (
                    <img src={entry.photoUrl} alt={entry.displayName} className="w-12 h-12 rounded-full object-cover object-top flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold flex-shrink-0">
                      {entry.displayName[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm group-hover:text-zinc-100 truncate">{entry.displayName}</p>
                    {entry.occupationSummary && (
                      <p className="text-zinc-500 text-xs capitalize truncate">{entry.occupationSummary.replace(/_/g, ' ')}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-amber-400 font-bold text-sm">{Math.round(entry.popularityScore)}</p>
                    <p className="text-zinc-600 text-xs">score</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* News Feed */}
          {newsFeed.length > 0 && <NewsFeedSection articles={newsFeed} />}

          {/* Browse more CTA */}
          <section className="px-6 sm:px-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <h3 className="text-xl font-bold text-white mb-2">Browse All People</h3>
              <p className="text-zinc-500 text-sm mb-6">
                Explore our full database of public figures — from world leaders to athletes, scientists, and entertainers.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/browse"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors text-sm"
                >
                  Browse All People →
                </Link>
                <Link
                  href="/search"
                  className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
                >
                  Search
                </Link>
              </div>
            </div>
          </section>
        </div>
      ) : (
        // Sorted / paginated table views
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            {isTrending
              ? <TrendingTable entries={trendingEntries} timespan={timespanMap[sortKey as keyof typeof timespanMap]} />
              : <LeaderboardTable entries={entries} startRank={offset + 1} />
            }
          </div>

          {/* Pagination */}
          {!isTrending && (hasPrevPage || hasNextPage) && (
            <div className="flex items-center justify-between pt-2">
              <div>
                {hasPrevPage ? (
                  <Link href={pageUrl(currentPage - 1)} className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">
                    ← Previous
                  </Link>
                ) : <span />}
              </div>
              <span className="text-sm text-zinc-500">#{offset + 1}–#{offset + entries.length}</span>
              <div>
                {hasNextPage ? (
                  <Link href={pageUrl(currentPage + 1)} className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">
                    Next →
                  </Link>
                ) : <span />}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
