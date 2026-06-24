import { getPersonTrendingReason } from '../../lib/api';

interface Props {
  displayName: string;
  wikidataQid: string;
}

export async function NewsSection({ displayName, wikidataQid }: Props) {
  const reason = await getPersonTrendingReason(displayName, wikidataQid).catch(() => null);
  if (!reason) return null;

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔥</span>
        <h2 className="font-bold text-white">Why They&apos;re Trending</h2>
        <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
          {reason.timespan}
        </span>
      </div>

      <ul className="space-y-2">
        {reason.bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
            <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      {reason.articles.length > 0 && (
        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Source Articles</p>
          <ul className="space-y-3">
            {reason.articles.map((article, i) => (
              <li key={i}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 text-sm hover:text-white transition-colors"
                >
                  <span className="text-red-500/50 group-hover:text-red-400 mt-0.5 flex-shrink-0">↗</span>
                  <span className="text-zinc-400 group-hover:text-zinc-200 flex-1 leading-snug">
                    {article.title}
                  </span>
                  <span className="text-zinc-600 text-xs flex-shrink-0 mt-0.5">{article.domain}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-zinc-700 pt-1">Source: GDELT Project</p>
        </div>
      )}
    </div>
  );
}

export function NewsSectionSkeleton() {
  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-zinc-800 rounded" />
        <div className="w-40 h-4 bg-zinc-800 rounded" />
      </div>
      <div className="space-y-2">
        <div className="w-full h-3 bg-zinc-800 rounded" />
        <div className="w-3/4 h-3 bg-zinc-800 rounded" />
        <div className="w-5/6 h-3 bg-zinc-800 rounded" />
      </div>
    </div>
  );
}
