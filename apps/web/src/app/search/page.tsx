import Link from 'next/link';
import { Suspense } from 'react';
import { SearchBar } from '../../components/shared/SearchBar.js';
import { searchPeople } from '../../lib/api.js';

type SearchParams = Promise<{ q?: string }>;

async function SearchResults({ query }: { query: string }) {
  const results = await searchPeople(query);

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="font-medium">No results found for &ldquo;{query}&rdquo;</p>
        <p className="text-sm mt-1">Try a different name or spelling.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {results.map((person) => (
        <li key={person.id}>
          <Link
            href={`/people/${person.wikidataQid}`}
            className="flex items-center justify-between py-3 px-2 rounded hover:bg-gray-50 transition-colors group"
          >
            <div>
              <span className="font-medium text-gray-900 group-hover:text-indigo-600">
                {person.displayName}
              </span>
              {person.occupationSummary && (
                <span className="text-sm text-gray-400 capitalize ml-2">
                  {person.occupationSummary.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <span className="text-xs font-mono text-gray-300">{person.wikidataQid}</span>
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Search</h1>
        <p className="text-gray-500 text-sm">Find public figures in the PAI database</p>
      </div>

      <SearchBar defaultValue={query} placeholder="Search by name..." />

      {query.length >= 2 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <Suspense
            fallback={
              <div className="py-8 text-center text-gray-400 text-sm">Searching...</div>
            }
          >
            <SearchResults query={query} />
          </Suspense>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400 text-sm">
          Type at least 2 characters to search
        </div>
      )}
    </div>
  );
}
