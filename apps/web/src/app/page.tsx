export const revalidate = 300;

import Link from 'next/link';
import type { LeaderboardEntry, TrendingEntry, ViewPerson } from '../lib/api';
import { getLeaderboard, getTrendingLeaderboard, getNewsFeed } from '../lib/api';
import { HeroSection } from '../components/home/HeroSection';
import { PersonCarousel } from '../components/home/PersonCarousel';
import { NewsFeedSection } from '../components/home/NewsFeedSection';

type SearchParams = Promise<{ sort?: string; page?: string }>;

const TABS = [
  { key: 'popularity',    label: 'All Time' },
  { key: 'heat',          label: '🌡️ Heat' },
  { key: 'trending_1h',   label: '🔥 Last Hour' },
  { key: 'trending_24h',  label: '🔥 Last 24h' },
  { key: 'trending_30d',  label: '🔥 Last 30d' },
] as const;

type SortKey = typeof TABS[number]['key'];

interface ViewConfig {
  rankLabel: string;
  carouselTitle: string;
  carouselIcon: string;
  gridScoreLabel: string;
  updatedNote: string;
}

const VIEW_CONFIG: Record<SortKey, ViewConfig> = {
  popularity:   { rankLabel: 'Most Popular',       carouselTitle: 'Most Popular All Time',  carouselIcon: '⭐', gridScoreLabel: 'Popularity', updatedNote: 'Updated every hour' },
  heat:         { rankLabel: 'Hottest Right Now',  carouselTitle: 'Hottest Right Now',      carouselIcon: '🌡️', gridScoreLabel: 'Heat',       updatedNote: 'Updated every hour' },
  trending_1h:  { rankLabel: 'Trending This Hour', carouselTitle: 'Trending This Hour',     carouselIcon: '🔥', gridScoreLabel: 'Articles',   updatedNote: 'Updated every 15 min' },
  trending_24h: { rankLabel: 'Trending Today',     carouselTitle: 'Trending Today',         carouselIcon: '🔥', gridScoreLabel: 'Articles',   updatedNote: 'Updated every 15 min' },
  trending_30d: { rankLabel: 'Trending This Month',carouselTitle: 'Trending This Month',    carouselIcon: '🔥', gridScoreLabel: 'Articles',   updatedNote: 'Updated every 15 min' },
};

// Trending tabs show top 100, no pagination
const TRENDING_LIMIT = 100;
// Leaderboard pages: 50 per page (25 per column, 2 columns)
const PAGE_SIZE = 50;

const TIMESPANS = { trending_1h: '1h', trending_24h: '24h', trending_30d: '30d' } as const;

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

  const [leaderboardEntries, trendingEntries, newsFeed] = await Promise.all([
    !isTrending
      ? getLeaderboard(sortKey === 'heat' ? 'heat' : 'popularity', PAGE_SIZE, offset)
      : Promise.resolve([] as LeaderboardEntry[]),
    isTrending
      ? getTrendingLeaderboard(TIMESPANS[sortKey as keyof typeof TIMESPANS], TRENDING_LIMIT)
      : Promise.resolve([] as TrendingEntry[]),
    isDefaultView ? getNewsFeed() : Promise.resolve([]),
  ]);

  const viewPeople: ViewPerson[] = isTrending
    ? trendingEntries.map((e, i) => trendingToView(e, i + 1))
    : leaderboardEntries.map(e =>
        leaderboardToView(e, sortKey === 'heat' ? 'heat' : 'popularity'),
      );

  const hero = viewPeople[0];
  // Trending tabs: no pagination. Leaderboard: show Next if we got a full page.
  const hasNextPage = !isTrending && leaderboardEntries.length === PAGE_SIZE;
  const hasPrevPage = !isTrending && currentPage > 1;

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (sortKey !== 'popularity') params.set('sort', sortKey);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  }

  // Carousel shows first 10 as portrait cards; full grid shows all 50
  const carouselPeople = viewPeople.slice(0, 10);

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

      <div className="space-y-10 pt-10">

        {/* Carousel — top 10 portrait cards */}
        {carouselPeople.length > 0 && (
          <PersonCarousel
            title={cfg.carouselTitle}
            icon={cfg.carouselIcon}
            people={carouselPeople}
          />
        )}

        {/* Full ranked grid — 2 columns, 25 per column = 50 per page */}
        {viewPeople.length > 0 && (
          <section className="px-6 sm:px-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {isTrending
                  ? `Top ${viewPeople.length} ${cfg.rankLabel}`
                  : `#${offset + 1}–#${offset + viewPeople.length} ${cfg.rankLabel}`}
              </h2>
              <span className="text-xs text-zinc-600">{cfg.updatedNote}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {viewPeople.map((person) => (
                <Link
                  key={person.wikidataQid}
                  href={`/people/${person.wikidataQid}`}
                  className="flex items-center gap-4 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all group"
                >
                  <span className="text-3xl font-black text-zinc-700 w-10 flex-shrink-0 leading-none tabular-nums">
                    {person.rank}
                  </span>
                  {person.photoUrl ? (
                    <img
                      src={person.photoUrl}
                      alt={person.displayName}
                      className="w-11 h-11 rounded-full object-cover object-top flex-shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-sm flex-shrink-0">
                      {person.displayName[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm group-hover:text-zinc-100 truncate">
                      {person.displayName}
                    </p>
                    {person.occupationSummary && (
                      <p className="text-zinc-500 text-xs capitalize truncate">
                        {person.occupationSummary.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${person.primaryColor}`}>
                      {Math.round(person.primaryScore)}
                    </p>
                    <p className="text-zinc-600 text-xs">{person.primaryLabel}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {viewPeople.length === 0 && (
          <div className="text-center py-20 px-6">
            {isTrending ? (
              <>
                <p className="text-lg font-medium text-zinc-400">Trending data is being computed</p>
                <p className="text-sm mt-2 text-zinc-600">
                  The background worker updates trending every 15 minutes. Check back shortly.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-zinc-400">No scores yet</p>
                <p className="text-sm mt-2 text-zinc-600">
                  Run <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">pnpm score:calculate</code> to generate scores.
                </p>
              </>
            )}
          </div>
        )}

        {/* News feed — default view only */}
        {isDefaultView && newsFeed.length > 0 && <NewsFeedSection articles={newsFeed} />}

        {/* Pagination — leaderboard only, trending has no pagination */}
        {!isTrending && (hasPrevPage || hasNextPage) && (
          <div className="flex items-center justify-between px-6 sm:px-8">
            {hasPrevPage ? (
              <Link
                href={pageUrl(currentPage - 1)}
                className="px-5 py-2.5 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-zinc-500 font-mono">
              #{offset + 1}–#{offset + leaderboardEntries.length}
            </span>
            {hasNextPage ? (
              <Link
                href={pageUrl(currentPage + 1)}
                className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
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
    </div>
  );
}
