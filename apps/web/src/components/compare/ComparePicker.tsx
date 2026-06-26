'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  wikidataQid: string;
  displayName: string;
  occupationSummary: string | null;
  photoUrl: string | null;
}

interface Props {
  qidA: string | null;
  nameA: string | null;
}

export function ComparePicker({ qidA, nameA }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          setResults(data.filter(r => r.wikidataQid !== qidA).slice(0, 6));
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, qidA]);

  function pick(qidB: string) {
    if (qidA) {
      router.push(`/compare?a=${qidA}&b=${qidB}`);
    } else {
      router.push(`/compare?a=${qidB}`);
    }
  }

  const label = qidA
    ? `Search for someone to compare with ${nameA ?? 'them'}…`
    : 'Search for a person…';

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={label}
          className="w-full bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-xl pl-9 pr-4 py-2.5 text-sm border border-zinc-700 focus:outline-none focus:border-red-600 transition-colors"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
        )}
      </div>

      {results.length > 0 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-xl">
          {results.map(r => (
            <button
              key={r.wikidataQid}
              onClick={() => pick(r.wikidataQid)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 transition-colors text-left border-b border-zinc-700/50 last:border-0"
            >
              {r.photoUrl ? (
                <img
                  src={r.photoUrl}
                  alt={r.displayName}
                  className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-600 flex items-center justify-center text-zinc-300 font-bold text-xs flex-shrink-0">
                  {r.displayName[0]}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{r.displayName}</p>
                {r.occupationSummary && (
                  <p className="text-xs text-zinc-500 capitalize truncate">{r.occupationSummary.replace(/_/g, ' ')}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && results.length === 0 && !loading && (
        <p className="text-xs text-zinc-600 text-center pt-1">No results found</p>
      )}
    </div>
  );
}
