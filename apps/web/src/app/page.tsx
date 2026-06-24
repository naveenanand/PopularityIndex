export const revalidate = 60;

import Link from 'next/link';
import type { LeaderboardEntry, TrendingEntry, ViewPerson } from '../lib/api';
import { getLeaderboard, getTrendingLeaderboard, getNewsFeed } from '../lib/api';
import { HeroSection } from '../components/home/HeroSection';
import { PersonCarousel } from '../components/home/PersonCarousel';
import { NewsFeedSection } from '../components/home/NewsFeedSection';

type SearchParams = Promise<{ sort?: string; page?: string }>;

const TABS = [
  { key: 'popularity', label: 'All Time' },
  { key: 'heat',       label: '🌡️ Heat' },
  { key: 'trending_1h',  label: '🔥 Last Hour' },
  { key: 'trending_24h', label: '🔥 Last 24h' },
  { key: 'trending_30d', label: '🔥 Last 30d' },
] as const;

type SortKey = typeof TABS[number]['key'];

interface ViewConfig {
  rankLabel: string;
  carouselTitle: string;
  carouselIcon: string;
  gridScoreLabel: string;
}

const VIEW_CONFIG: Record<SortKey, ViewConfig> = {
  popularity: { rankLabel: 'Most Popular',      carouselTitle: 'Most Popular All Time',  carouselIcon: '⭐', gridScoreLabel: 'Popularity' },
  heat:       { rankLabel: 'Hottest Right Now', carouselTitle: 'Hottest Right Now',      carouselIcon: '🌡️', gridScoreLabel: 'Heat'       },
  trending_1h:  { rankLabel: 'Trending This Hour',  carouselTitle: 'Trending This Hour',  carouselIcon: '🔥', gridScoreLabel: 'Articles'  },
  trending_24h: { rankLabel: 'Trending Today',       carouselTitle: 'Trending Today',      carouselIcon: '🔥', gridScoreLabel: 'Articles'  },
  trending_30d: { rankLabel: 'Trending This Month',  carouselTitle: 'Trending This Month', carouselIcon: '🔥', gridScoreLabel: 'Articles'  },
};

const PAGE_SIZE = 100;
const TIMESPANS = { trending_1h: '1h', trending_24h: '24h', trending_30d: '30d' } as const;

// Convert a LeaderboardEntry to ViewPerson
function leaderboardToView(entry: LeaderboardEntry, sort: 'popularity' | 'heat'): ViewPerson {
  const isHeat = sort === 'heat';
  return {
    wikidataQid: entry.wikidataQid,
    displayName: entry.displayName,
    photoUrl: entry.photoUrl,
    occupationSummary: entry.occupationSummary,
    rank: entry.rank,
    primaryScore: isHeat ? entry.heatScore : entry.popularityScore,
    primaryLabel: isHeat ? 'Heat' : 'Popularity',
    primaryColor: isHeat ? 'text-orange-400' : 'text-amber-400',
    secondaryScore: isHeat ? entry.popularityScore : entry.heatScore,
    secondaryLabel: isHeat ? 'Popularity' : 'Heat',
    secondaryColor: isHeat ? 'text-amber-400' : 'text-orange-400',
    badge: entry.coverageLabel,
  };
}

// Convert a TrendingEntry to ViewPerson
function trendingToView(entry: TrendingEntry, rank: number): ViewPerson {
  return {
    wikidataQid: entry.wikidataQid,
    displayName: entry.displayName,
    photoUrl: entry.photoUrl,
    occupationSummary: entry.occupationSummary,
    rank,
    primaryScore: entry.articleCount,
    primaryLabel: 'Articles',
    primaryColor: 'text-red-400',
    secondaryScore: Math.round(entry.popularityScore),
    secondaryLabel: 'Popularity',
    secondaryColor: 'text-amber-400',
  };
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { sort, page } = await searchParams;
  const sortKey: SortKey = (TABS.find(t => t.key === sort)?.key) ?? 'popularity';
  const currentPage = Math.max(1, parseInt(page ?? '1', 10));
  const offset = (currentPage - 1) * PAGE_SIZE;
  const isTrending = sortKey.startsWith('trending_');
  const isDefaultView = sortKey === 'popularity' && currentPage === 1;
  const cfg = VIEW_CONFIG[sortKey];

  // Fetch data
  const [leaderboardEntries, trendingEntries, newsFeed] = await Promise.all([
    !isTrending
      ? getLeaderboard(sortKey === 'heat' ? 'heat' : 'popularity', PAGE_SIZE, offset)
      : Promise.resolve([] as LeaderboardEntry[]),
    isTrending
      ? getTrendingLeaderboard(TIMESPANS[sortKey as keyof typeof TIMESPANS], 50)
      : Promise.resolve([] as TrendingEntry[]),
    isDefaultView ? getNewsFeed() : Promise.resolve([]),
  ]);

  // Normalize to ViewPerson
  const viewPeople: ViewPerson[] = isTrending
    ? trendingEntries
        .filter(e => e.articleCount > 0)
        .map((e, i) => trendingToView(e, i + 1))
    : leaderboardEntries.map(e =>
        leaderboardToView(e, sortKey === 'heat' ? 'heat' : 'popularity')
      );

  const hero = viewPeople[0];
  const hasNextPage = !isTrending && leaderboardEntries.length === PAGE_SIZE;
  const hasPrevPage = currentPage > 1;

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (sortKey !== 'popularity') params.set('sort', sortKey);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  }

  return (
    <div className="space-y-0 pb-16">

      {/* Hero — #1 person for the current view */}
      {hero && <HeroSection person={hero} rankLabel={cfg.rankLabel} />}

      {/* Tab bar */}
      <div className="sticky top-16 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map(tab => {
            const active = sortKey === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.key === 'popularity' ? '/' : `/?sort=${tab.key}`}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  active ? 'bg-white text-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Netflix-style content — same layout for every tab */}
      <div className="space-y-10 pt-10">

        {/* Carousel */}
        <PersonCarousel
          title={cfg.carouselTitle}
          icon={cfg.carouselIcon}
          people={viewPeople}
          seeAllHref={!isTrending && hasNextPage ? pageUrl(currentPage + 1) : undefined}
        />

        {/* Top 10 grid */}
        {viewPeople.length > 0 && (
          <section className="px-6 sm:px-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Top 10 {cfg.rankLabel}</h2>
              <span className="text-xs text-zinc-600">Updated every 60s</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {viewPeople.slice(0, 10).map((person) => (
                <Link
                  key={person.wikidataQid}
                  href={`/people/${person.wikidataQid}`}
                  className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all group"
                >
                  <span className="text-4xl font-black text-zinc-700 w-10 flex-shrink-0 leading-none">
                    {person.rank}
                  </span>
                  {person.photoUrl ? (
                    <img src={person.photoUrl} alt={person.displayName} className="w-12 h-12 rounded-full object-cover object-top flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold flex-shrink-0">
                      {person.displayName[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm group-hover:text-zinc-100 truncate">{person.displayName}</p>
                    {person.occupationSummary && (
                      <p className="text-zinc-500 text-xs capitalize truncate">{person.occupationSummary.replace(/_/g, ' ')}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${person.primaryColor}`}>{Math.round(person.primaryScore)}</p>
                    <p className="text-zinc-600 text-xs">{person.primaryLabel}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for trending */}
        {isTrending && viewPeople.length === 0 && (
          <div className="text-center py-20 text-zinc-600">
            <p className="text-lg font-medium text-zinc-400">No articles found for this window</p>
            <p className="text-sm mt-2">Try a wider time range, or check back shortly.</p>
          </div>
        )}

        {/* News feed — default view only */}
        {isDefaultView && newsFeed.length > 0 && <NewsFeedSection articles={newsFeed} />}

        {/* Pagination */}
        {!isTrending && (hasPrevPage || hasNextPage) && (
          <div className="flex items-center justify-between px-6 sm:px-8">
            {hasPrevPage ? (
              <Link href={pageUrl(currentPage - 1)} className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">
                ← Previous
              </Link>
            ) : <span />}
            <span className="text-sm text-zinc-500">#{offset + 1}–#{offset + leaderboardEntries.length}</span>
            {hasNextPage ? (
              <Link href={pageUrl(currentPage + 1)} className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors">
                Next →
              </Link>
            ) : <span />}
          </div>
        )}

        {/* Browse CTA */}
        <section className="px-6 sm:px-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Browse All People</h3>
            <p className="text-zinc-500 text-sm mb-6">
              Explore our full database of public figures — from world leaders to athletes, scientists, and entertainers.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/browse" className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors text-sm">
                Browse All People →
              </Link>
              <Link href="/search" className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm">
                Search
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
