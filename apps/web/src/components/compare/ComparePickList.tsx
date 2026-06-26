'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface Person {
  wikidataQid: string;
  displayName: string;
  occupationSummary: string | null;
  photoUrl: string | null;
  popularityScore: number;
}

interface Props {
  people: Person[];
  qidA: string;
}

export function ComparePickList({ people, qidA }: Props) {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      p =>
        p.displayName.toLowerCase().includes(q) ||
        p.occupationSummary?.toLowerCase().includes(q),
    );
  }, [query, people]);

  function pick(qidB: string) {
    router.push(`/compare?a=${qidA}&b=${qidB}`);
  }

  return (
    <div className="space-y-4">
      {/* Search box */}
      <div className="relative max-w-sm">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or occupation…"
          className="w-full bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-xl pl-9 pr-4 py-2.5 text-sm border border-zinc-700 focus:outline-none focus:border-red-600 transition-colors"
          autoFocus
        />
      </div>

      {/* Count */}
      <p className="text-xs text-zinc-600">
        {filtered.length} {filtered.length === 1 ? 'person' : 'people'} — click any to start comparing
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 text-sm">No results for "{query}"</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {filtered.map(person => (
            <button
              key={person.wikidataQid}
              onClick={() => pick(person.wikidataQid)}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-blue-600/50 transition-all text-left cursor-pointer"
            >
              {person.photoUrl ? (
                <img
                  src={person.photoUrl}
                  alt={person.displayName}
                  className="w-12 h-12 rounded-full object-cover object-top border-2 border-zinc-700 group-hover:border-blue-600/50 transition-colors flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-zinc-700 border-2 border-zinc-700 group-hover:border-blue-600/50 flex items-center justify-center text-zinc-300 font-bold text-base flex-shrink-0 transition-colors">
                  {person.displayName[0]}
                </div>
              )}
              <div className="text-center min-w-0 w-full">
                <p className="font-semibold text-zinc-100 text-xs group-hover:text-white line-clamp-2 transition-colors leading-tight">
                  {person.displayName}
                </p>
                {person.occupationSummary && (
                  <p className="text-zinc-600 text-[10px] mt-0.5 capitalize line-clamp-1">
                    {person.occupationSummary.replace(/_/g, ' ')}
                  </p>
                )}
                <p className="text-amber-400/70 text-[10px] font-mono mt-1">
                  {Math.round(person.popularityScore)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
