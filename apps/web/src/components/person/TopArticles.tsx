import type { NewsArticle } from '../../lib/api';

interface Props {
  articles: NewsArticle[];
}

function formatArticleDate(seendate: string): string {
  const d = seendate.replace(/(\d{4})(\d{2})(\d{2})T.*/, '$1-$2-$3');
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TopArticles({ articles }: Props) {
  if (articles.length === 0) return null;

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
      <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">In the News</h2>
      <div className="space-y-4">
        {articles.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 group"
          >
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 text-zinc-500 text-xs flex items-center justify-center font-bold mt-0.5">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-200 group-hover:text-white leading-snug transition-colors">
                {article.title}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {article.domain} · {formatArticleDate(article.seendate)}
              </p>
            </div>
          </a>
        ))}
      </div>
      <p className="text-[10px] text-zinc-700 mt-4">Source: GDELT Project · Last 7 days</p>
    </div>
  );
}
