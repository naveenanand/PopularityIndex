import type { NewsArticle } from '../../lib/api';

interface Props {
  articles: NewsArticle[];
}

function formatArticleDate(seendate: string): string {
  // GDELT format: "20241215T123000Z"
  const d = seendate.replace(/(\d{4})(\d{2})(\d{2})T.*/, '$1-$2-$3');
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TopArticles({ articles }: Props) {
  if (articles.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">In the News</h2>
      <div className="space-y-4">
        {articles.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 group"
          >
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center font-semibold mt-0.5">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 leading-snug">
                {article.title}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {article.domain} · {formatArticleDate(article.seendate)}
              </p>
            </div>
          </a>
        ))}
      </div>
      <p className="text-[10px] text-gray-300 mt-4">Source: GDELT Project · Last 7 days</p>
    </div>
  );
}
