'use client';

import { useState, useEffect, useCallback } from 'react';

interface NewsArticle {
  title: string;
  url: string;
  domain: string;
  seendate: string;
}

interface Props {
  wikidataQid: string;
}

const MAX_ARTICLES = 10;
const POLL_INTERVAL_MS = 60_000;

export function NewsSection({ wikidataQid }: Props) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch(`/api/news/${wikidataQid}`, { cache: 'no-store' });
      if (!res.ok) return;
      const fresh: NewsArticle[] = await res.json();
      if (fresh.length === 0) return;

      setArticles(prev => {
        const existingUrls = new Set(prev.map(a => a.url));
        const newOnes = fresh.filter(a => !existingUrls.has(a.url));
        // Newest articles at top; drop oldest beyond MAX_ARTICLES
        return [...newOnes, ...prev].slice(0, MAX_ARTICLES);
      });
      setLastUpdated(new Date());
    } catch {
      // silent — keep showing whatever we have
    } finally {
      setLoading(false);
    }
  }, [wikidataQid]);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchNews]);

  if (loading) return <NewsSectionSkeleton />;
  if (articles.length === 0) return null;

  const minutesAgo = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 60_000)
    : null;

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔥</span>
        <h2 className="font-bold text-white">In the News</h2>
        <span className="flex items-center gap-1 ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] text-red-400 font-medium">LIVE</span>
        </span>
        {minutesAgo !== null && (
          <span className="ml-auto text-[10px] text-zinc-600">
            updated {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`}
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {articles.map((article, i) => (
          <li key={article.url}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 text-sm hover:text-white transition-colors"
            >
              <span className="text-red-500/50 group-hover:text-red-400 mt-0.5 flex-shrink-0">↗</span>
              <span className="flex-1 leading-snug text-zinc-300 group-hover:text-white">
                {article.title}
              </span>
              <span className="text-zinc-600 text-[10px] flex-shrink-0 mt-0.5 whitespace-nowrap">
                {article.domain}
              </span>
            </a>
            {i < articles.length - 1 && (
              <div className="mt-3 border-b border-zinc-800/60" />
            )}
          </li>
        ))}
      </ul>

      <p className="text-[10px] text-zinc-700 pt-1">
        Source: Google News RSS · Refreshes every 60s
      </p>
    </div>
  );
}

export function NewsSectionSkeleton() {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-zinc-800 rounded" />
        <div className="w-32 h-4 bg-zinc-800 rounded" />
        <div className="w-8 h-3 bg-zinc-800 rounded ml-2" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="w-full h-3 bg-zinc-800 rounded" />
            <div className="w-3/4 h-3 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
