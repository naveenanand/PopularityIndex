import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPersonWithScores, getPersonTrendingReason } from '../../../lib/api';
import { ScoreHistoryChart } from '../../../components/person/ScoreHistoryChart';
import { DataSourceBadge } from '../../../components/shared/DataSourceBadge';
import { formatDate, formatScore, coverageBadgeColor } from '../../../lib/formatters';
import type { ScoreExplanation } from '@pai/shared';

export const revalidate = 300; // 5 min cache — trending data changes with cron

interface PageProps {
  params: Promise<{ wikidataQid: string }>;
}

export default async function PersonPage({ params }: PageProps) {
  const { wikidataQid } = await params;

  // Fetch person from DB first (lightweight — just id + displayName needed for trending call)
  const data = await getPersonWithScores(wikidataQid);
  if (!data) return notFound();

  const { person, latestScore, scoreHistory } = data;
  const photoUrl = person.photoUrl;
  const occupation = person.occupationSummary?.replace(/_/g, ' ') ?? '';
  const explanation = latestScore?.explanationJson as ScoreExplanation | undefined;

  // Fetch trending reason with displayName so the GDELT fallback can run if needed.
  // Single DB query for all cache keys; GDELT capped at 3s if caches are empty.
  const trendingReasonFinal = await getPersonTrendingReason(person.displayName, wikidataQid).catch(() => null);

  return (
    <div className="min-h-screen">
      {/* Hero banner */}
      <div className="relative h-48 sm:h-64 overflow-hidden">
        {photoUrl ? (
          <img src={photoUrl} alt={person.displayName} className="absolute inset-0 w-full h-full object-cover object-top" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 to-transparent" />
      </div>

      {/* Content — overlaps the hero */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-24 relative z-10 space-y-6 pb-16">

        {/* Person header */}
        <div className="flex items-end gap-5">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={person.displayName}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover object-top border-4 border-[#0a0a0a] flex-shrink-0 shadow-xl"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-zinc-700 border-4 border-[#0a0a0a] flex items-center justify-center text-zinc-300 font-black text-3xl flex-shrink-0 shadow-xl">
              {person.displayName.charAt(0)}
            </div>
          )}

          <div className="pb-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{person.displayName}</h1>
            {occupation && (
              <p className="text-zinc-400 text-sm capitalize mt-0.5">{occupation}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">
                {person.wikidataQid}
              </span>
              <a
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(person.displayName.replace(/ /g, '_'))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Wikipedia →
              </a>
            </div>
          </div>

          <div className="ml-auto flex-shrink-0 pb-1">
            <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">
              ← Back
            </Link>
          </div>
        </div>

        {/* Score cards — from DB, no live GDELT call */}
        {latestScore ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center">
              <div className="text-3xl font-black text-amber-400">{formatScore(latestScore.popularityScore)}</div>
              <div className="text-xs text-zinc-500 mt-1">Popularity</div>
            </div>
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center">
              <div className="text-3xl font-black text-orange-400">{formatScore(latestScore.heatScore)}</div>
              <div className="text-xs text-zinc-500 mt-1">Heat</div>
            </div>
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center">
              <div className="text-3xl font-black text-zinc-200">{Math.round(latestScore.coverageScore)}</div>
              <div className="mt-1.5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${coverageBadgeColor(explanation?.coverage_label ?? 'Partial coverage')}`}>
                  {explanation?.coverage_label ?? 'Partial coverage'}
                </span>
              </div>
            </div>
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center">
              <div className="text-3xl font-black text-zinc-200">{Math.round(latestScore.confidenceScore)}</div>
              <div className="text-xs text-zinc-500 mt-1">Confidence</div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 text-center text-zinc-500 text-sm">
            No score computed yet. Run <code className="text-xs bg-zinc-800 px-1 rounded">pnpm score:calculate</code> to generate scores.
          </div>
        )}

        {/* Why Trending + Source Articles — from cache, falls back to live GDELT */}
        {trendingReasonFinal && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <h2 className="font-bold text-white">Why They&apos;re Trending</h2>
              <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                {trendingReasonFinal.timespan}
              </span>
            </div>

            <ul className="space-y-2">
              {trendingReasonFinal.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            {trendingReasonFinal.articles.length > 0 && (
              <div className="border-t border-zinc-800 pt-4 space-y-2">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Source Articles</p>
                <ul className="space-y-3">
                  {trendingReasonFinal.articles.map((article, i) => (
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
        )}

        {/* Score history */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white">Score History</h2>
            <span className="text-xs text-zinc-600">
              {scoreHistory[0] ? `Last snapshot ${formatDate(scoreHistory[0].calculatedAt)}` : 'No history yet'}
            </span>
          </div>
          <ScoreHistoryChart history={scoreHistory} />
        </div>

        {/* Signal breakdown — from explanation JSON in DB */}
        {explanation && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-3">
            <h2 className="font-bold text-white text-sm">Score Breakdown</h2>
            {explanation.top_contributors && explanation.top_contributors.length > 0 && (
              <div className="space-y-2">
                {explanation.top_contributors.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-zinc-800/60 pb-1.5">
                    <span className="text-zinc-400 capitalize">{c.signal.replace(/_/g, ' ')}</span>
                    <span className={`font-mono text-xs ${parseFloat(c.impact) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {c.impact}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {explanation.signals_missing && explanation.signals_missing.length > 0 && (
              <p className="text-xs text-zinc-600">
                Missing signals: {explanation.signals_missing.slice(0, 4).join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Data sources */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-3">
          <h2 className="font-bold text-white text-sm">Data Sources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {[
              { name: 'Wikipedia pageviews', type: 'live' as const },
              { name: 'Wikidata sitelinks', type: 'live' as const },
              { name: 'Wikipedia metadata', type: 'live' as const },
              { name: 'Search interest (Wikipedia top articles)', type: 'live' as const },
              { name: 'News coverage (GDELT)', type: 'live' as const },
              { name: 'Sentiment (GDELT headlines)', type: 'live' as const },
              { name: 'YouTube social reach', type: 'live' as const },
              { name: 'Reddit conversation', type: 'partial' as const },
            ].map(source => (
              <div key={source.name} className="flex items-center justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-400">{source.name}</span>
                <DataSourceBadge type={source.type} />
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            Scores computed by daily job. News data cached via GDELT trending cron.
          </p>
        </div>
      </div>
    </div>
  );
}
