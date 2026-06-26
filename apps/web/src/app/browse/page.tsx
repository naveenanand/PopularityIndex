export const revalidate = 300;

import Link from 'next/link';
import { browsePeople, searchPeople, getCategories } from '../../lib/api';

type SearchParams = Promise<{ q?: string; page?: string }>;

const PAGE_SIZE = 60;

export default async function BrowsePage({ searchParams }: { searchParams: SearchParams }) {
  const { q, page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? '1', 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const isSearch = !!q && q.trim().length >= 2;

  const [browseResult, searchResults, categories] = await Promise.all([
    !isSearch ? browsePeople(offset, PAGE_SIZE) : Promise.resolve({ items: [], total: 0 }),
    isSearch ? searchPeople(q.trim()) : Promise.resolve([]),
    !isSearch ? getCategories() : Promise.resolve([]),
  ]);

  const items = isSearch ? searchResults : browseResult.items;
  const total = isSearch ? searchResults.length : browseResult.total;
  const hasNext = !isSearch && offset + PAGE_SIZE < browseResult.total;
  const hasPrev = currentPage > 1;

  function pageUrl(p: number, query?: string) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/browse${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-zinc-600 uppercase tracking-widest font-semibold">
          <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-zinc-500">Browse</span>
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">Browse People</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {isSearch
              ? `${total.toLocaleString()} result${total !== 1 ? 's' : ''} for "${q}"`
              : `${total.toLocaleString()} people in the database`}
          </p>
        </div>
      </div>

      {/* Search bar */}
      <form method="GET" action="/browse" className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search by name..."
            className="w-full bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-xl pl-9 pr-4 py-2.5 text-sm border border-zinc-700 focus:outline-none focus:border-red-600 transition-colors"
          />
        </div>
        <button
          type="submit"
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          Search
        </button>
        {isSearch && (
          <Link
            href="/browse"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Category chips — only on non-search view */}
      {!isSearch && categories.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-600 uppercase tracking-widest font-semibold">Browse by category</p>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 20).map(cat => (
              <Link
                key={cat.slug}
                href={`/browse/${cat.slug}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-300 hover:text-white transition-all"
              >
                <span className="capitalize">{cat.label}</span>
                <span className="text-xs text-zinc-600 font-mono">
                  {cat.scoredCount > 0 ? cat.scoredCount : cat.count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Results grid */}
      {items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-400 text-lg font-medium">No people found</p>
          {isSearch && (
            <p className="text-zinc-600 text-sm mt-2">
              Try a different search or{' '}
              <Link href="/browse" className="text-red-400 hover:underline">browse all</Link>
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {items.map(person => (
            <Link
              key={person.wikidataQid}
              href={`/people/${person.wikidataQid}`}
              className="group bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-sm mb-3">
                {person.displayName[0]?.toUpperCase()}
              </div>
              <p className="font-semibold text-zinc-100 text-sm group-hover:text-white line-clamp-1 transition-colors">
                {person.displayName}
              </p>
              {person.occupationSummary && (
                <p className="text-zinc-600 text-xs mt-0.5 capitalize line-clamp-1">
                  {person.occupationSummary.replace(/_/g, ' ')}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isSearch && (hasPrev || hasNext) && (
        <div className="flex items-center justify-between pt-4">
          <div>
            {hasPrev ? (
              <Link href={pageUrl(currentPage - 1)} className="px-5 py-2.5 text-sm font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors">
                ← Previous
              </Link>
            ) : <span />}
          </div>
          <span className="text-sm text-zinc-600">
            Page {currentPage} · showing {offset + 1}–{Math.min(offset + PAGE_SIZE, browseResult.total)} of {browseResult.total.toLocaleString()}
          </span>
          <div>
            {hasNext ? (
              <Link href={pageUrl(currentPage + 1)} className="px-5 py-2.5 text-sm font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-colors">
                Next →
              </Link>
            ) : <span />}
          </div>
        </div>
      )}
    </div>
  );
}
