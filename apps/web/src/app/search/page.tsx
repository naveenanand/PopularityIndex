import Link from 'next/link';
import { Suspense } from 'react';
import { SearchBar } from '../../components/shared/SearchBar';
import { searchPeople } from '../../lib/api';

type SearchParams = Promise<{ q?: string }>;

async function SearchResults({ query }: { query: string }) {
  const results = await searchPeople(query);

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="font-medium">No results for &ldquo;{query}&rdquo;</p>
        <p className="text-sm mt-1 text-zinc-600">Try a different name or spelling.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-800">
      {results.map((person) => (
        <li key={person.id}>
          <Link
            href={`/people/${person.wikidataQid}`}
            className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-zinc-800 transition-colors group"
          >
            <div>
              <span className="font-medium text-zinc-100 group-hover:text-white">
                {person.displayName}
              </span>
              {person.occupationSummary && (
                <span className="text-sm text-zinc-500 capitalize ml-2">
                  {person.occupationSummary.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <span className="text-xs font-mono text-zinc-600">{person.wikidataQid}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Search</h1>
        <p className="text-zinc-500 text-sm">Find public figures in the PAI database</p>
      </div>

      <SearchBar defaultValue={query} placeholder="Search by name..." />

      {query.length >= 2 ? (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <Suspense
            fallback={
              <div className="py-8 text-center text-zinc-500 text-sm">Searching...</div>
            }
          >
            <SearchResults query={query} />
          </Suspense>
        </div>
      ) : (
        <div className="text-center py-12 text-zinc-600 text-sm">
          Type at least 2 characters to search
        </div>
      )}
    </div>
  );
}
