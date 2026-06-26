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

// seendate format from API: "YYYYMMDDHHmmss00000" (all digits, UTC)
function parseSeendate(s: string): Date | null {
  if (!s || s.length < 12) return null;
  try {
    return new Date(Date.UTC(
      parseInt(s.slice(0, 4), 10),
      parseInt(s.slice(4, 6), 10) - 1,
      parseInt(s.slice(6, 8), 10),
      parseInt(s.slice(8, 10), 10),
      parseInt(s.slice(10, 12), 10),
    ));
  } catch {
    return null;
  }
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

function formatDayLabel(d: Date): string {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const articleUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diffDays = Math.round((todayUTC - articleUTC) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined, timeZone: 'UTC' });
}

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

const MAX_ARTICLES = 15;

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
        const seen = new Set(prev.map(a => a.url));
        const merged = [...fresh.filter(a => !seen.has(a.url)), ...prev].slice(0, MAX_ARTICLES);
        // Sort newest first by seendate
        return merged.sort((a, b) => {
          const da = parseSeendate(a.seendate)?.getTime() ?? 0;
          const db = parseSeendate(b.seendate)?.getTime() ?? 0;
          return db - da;
        });
      });
      setLastUpdated(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [wikidataQid]);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, 60_000);
    return () => clearInterval(id);
  }, [fetchNews]);

  if (loading) return <NewsSectionSkeleton />;
  if (articles.length === 0) return null;

  // Group by day
  const groups = new Map<string, { label: string; items: typeof articles }>();
  for (const article of articles) {
    const date = parseSeendate(article.seendate);
    const key = date ? dayKey(date) : 'unknown';
    const label = date ? formatDayLabel(date) : 'Earlier';
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key)!.items.push(article);
  }

  const minutesAgo = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 60_000)
    : null;

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-1">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4">
        <span className="text-lg">🔥</span>
        <h2 className="font-bold text-white">In the News</h2>
        <span className="flex items-center gap-1 ml-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] text-red-400 font-medium">LIVE</span>
        </span>
        {minutesAgo !== null && (
          <span className="ml-auto text-[10px] text-zinc-600">
            updated {minutesAgo === 0 ? 'just now' : `${minutesAgo}m ago`}
          </span>
        )}
      </div>

      {/* Timeline */}
      {[...groups.values()].map(({ label, items }) => (
        <div key={label} className="relative">
          {/* Day separator */}
          <div className="flex items-center gap-3 py-2">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest whitespace-nowrap">
              {label}
            </span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          {/* Articles for this day */}
          <div className="space-y-0">
            {items.map((article, i) => {
              const date = parseSeendate(article.seendate);
              const timeStr = date ? formatTime(date) : null;
              return (
                <a
                  key={`${article.url}-${i}`}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 items-start py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 -mx-6 px-6 transition-colors"
                >
                  {/* Timeline dot + time */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5 w-14">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500/60 group-hover:bg-red-400 transition-colors mt-1" />
                    {timeStr && (
                      <span className="text-[10px] text-zinc-600 group-hover:text-zinc-500 whitespace-nowrap font-mono">
                        {timeStr}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 text-sm font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
                      {article.title}
                    </p>
                    <p className="text-zinc-600 text-[11px] mt-1">{article.domain}</p>
                  </div>

                  <span className="text-zinc-700 group-hover:text-zinc-500 text-xs flex-shrink-0 mt-0.5">↗</span>
                </a>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-[10px] text-zinc-700 pt-2">Source: Google News RSS · Refreshes every 60s</p>
    </div>
  );
}

export function NewsSectionSkeleton() {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-3 animate-pulse">
      <div className="flex items-center gap-2 pb-2">
        <div className="w-5 h-5 bg-zinc-800 rounded" />
        <div className="w-32 h-4 bg-zinc-800 rounded" />
        <div className="w-8 h-3 bg-zinc-800 rounded ml-2" />
      </div>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex gap-3 py-2 border-b border-zinc-800/50">
          <div className="w-14 flex flex-col items-center gap-1 pt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
            <div className="w-10 h-2.5 bg-zinc-800 rounded" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="w-full h-3 bg-zinc-800 rounded" />
            <div className="w-3/4 h-3 bg-zinc-800 rounded" />
            <div className="w-16 h-2 bg-zinc-800 rounded mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}
