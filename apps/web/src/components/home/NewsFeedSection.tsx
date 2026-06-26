'use client';

import Link from 'next/link';
import type { FeedArticle } from '../../lib/api';

function timeAgo(seendate: string): string {
  // seendate format: "20260623T120000Z"
  try {
    const year = seendate.slice(0, 4);
    const month = seendate.slice(4, 6);
    const day = seendate.slice(6, 8);
    const hour = seendate.slice(9, 11);
    const min = seendate.slice(11, 13);
    const d = new Date(`${year}-${month}-${day}T${hour}:${min}:00Z`);
    const diffMs = Date.now() - d.getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  } catch {
    return '';
  }
}

interface Props {
  articles: FeedArticle[];
}

export function NewsFeedSection({ articles }: Props) {
  if (articles.length === 0) return null;

  return (
    <section className="px-6 sm:px-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          <span className="mr-2">📰</span>Latest News
        </h2>
        <span className="text-xs text-zinc-600">Via Wikipedia · trending today</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {articles.slice(0, 9).map((article, i) => (
          <a
            key={`${article.url}-${i}`}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-zinc-900 hover:bg-zinc-800 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all"
          >
            {/* Person tag */}
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/people/${article.personQid}`}
                onClick={e => e.stopPropagation()}
                className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                {article.personName}
              </Link>
              <span className="text-zinc-700 text-xs">·</span>
              <span className="text-zinc-600 text-xs">{article.domain}</span>
            </div>

            {/* Headline */}
            <p className="text-zinc-200 text-sm font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
              {article.title}
            </p>

            {/* Time */}
            <p className="text-zinc-600 text-xs mt-2">{timeAgo(article.seendate)}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
