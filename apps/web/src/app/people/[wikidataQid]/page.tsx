import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPersonWithScores } from '../../../lib/api';
import { ScoreHistoryChart } from '../../../components/person/ScoreHistoryChart';
import { DataSourceBadge } from '../../../components/shared/DataSourceBadge';
import { NewsSection } from '../../../components/person/NewsSection';
import { SummarySection } from '../../../components/person/SummarySection';
import { formatDate, formatScore, coverageBadgeColor } from '../../../lib/formatters';
import type { ScoreExplanation } from '@pai/shared';

// Revalidate every 60s so news/cache updates appear quickly.
// Scores and bio are fast DB reads so the cost is low.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ wikidataQid: string }>;
}

export default async function PersonPage({ params }: PageProps) {
  const { wikidataQid } = await params;

  const data = await getPersonWithScores(wikidataQid);
  if (!data) return notFound();

  const { person, latestScore, scoreHistory } = data;
  const photoUrl = person.photoUrl;
  const occupation = person.occupationSummary?.replace(/_/g, ' ') ?? '';
  const explanation = latestScore?.explanationJson as ScoreExplanation | undefined;

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

      {/* Content */}
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

          <div className="ml-auto flex-shrink-0 pb-1 flex items-center gap-3">
            <Link
              href={`/compare?a=${person.wikidataQid}`}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors border border-zinc-800 rounded-lg px-2.5 py-1"
            >
              Compare ↔
            </Link>
            <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">
              ← Back
            </Link>
          </div>
        </div>

        {/* Score cards — from DB */}
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
            No score computed yet.
          </div>
        )}

        {/* AI summary — fetches from /api/summary/[qid], cached 24h */}
        <SummarySection wikidataQid={wikidataQid} displayName={person.displayName} />

        {/* News timeline — client component, polls /api/news/[qid] every 60s */}
        <NewsSection wikidataQid={wikidataQid} />

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

        {/* Signal breakdown */}
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
              { name: 'News coverage (Google News RSS)', type: 'live' as const },
              { name: 'Sentiment (headline analysis)', type: 'live' as const },
              { name: 'Social reach (YouTube / Wikidata)', type: 'live' as const },
              { name: 'Reddit conversation', type: 'live' as const },
            ].map(source => (
              <div key={source.name} className="flex items-center justify-between border-b border-zinc-800/60 pb-1.5">
                <span className="text-zinc-400">{source.name}</span>
                <DataSourceBadge type={source.type} />
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            Scores updated daily. News cached by trending cron.
          </p>
        </div>
      </div>
    </div>
  );
}
