import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPersonWithScores, getPersonPhoto, getPersonTopArticles } from '../../../lib/api';
import { ScoreHistoryChart } from '../../../components/person/ScoreHistoryChart';
import { SignalBreakdown } from '../../../components/person/SignalBreakdown';
import { SentimentPanel } from '../../../components/person/SentimentPanel';
import { TopArticles } from '../../../components/person/TopArticles';
import { DataSourceBadge } from '../../../components/shared/DataSourceBadge';
import { formatScore, formatDate, coverageBadgeColor } from '../../../lib/formatters';

interface PageProps {
  params: Promise<{ wikidataQid: string }>;
}

export default async function PersonPage({ params }: PageProps) {
  const { wikidataQid } = await params;
  const data = await getPersonWithScores(wikidataQid);

  if (!data) return notFound();

  const { person, latestScore, scoreHistory } = data;

  const [photoUrl, articles] = await Promise.all([
    getPersonPhoto(person.displayName),
    getPersonTopArticles(person.displayName),
  ]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={person.displayName}
              className="rounded-full object-cover w-16 h-16 border border-gray-200 shadow-sm flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl flex-shrink-0">
              {person.displayName.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{person.displayName}</h1>
            {person.occupationSummary && (
              <p className="text-gray-500 text-sm mt-0.5 capitalize">
                {person.occupationSummary.replace(/_/g, ' ')}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {person.wikidataQid}
              </span>
              <a
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(person.displayName.replace(/ /g, '_'))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:underline"
              >
                Wikipedia →
              </a>
            </div>
          </div>
        </div>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
          ← Leaderboard
        </Link>
      </div>

      {/* Score cards */}
      {latestScore ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-indigo-600">
              {formatScore(latestScore.popularityScore)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Popularity</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-amber-500">
              {formatScore(latestScore.heatScore)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Heat (trending)</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-gray-700">
              {Math.round(latestScore.coverageScore)}
            </div>
            <div className="mt-1">
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs border ${coverageBadgeColor(latestScore.explanationJson.coverage_label)}`}
              >
                {latestScore.explanationJson.coverage_label}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-gray-700">
              {Math.round(latestScore.confidenceScore)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Confidence</div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
          <p>No scores available yet.</p>
          <code className="text-xs mt-2 block">pnpm score:calculate</code>
        </div>
      )}

      {/* Top news articles */}
      <TopArticles articles={articles} />

      {/* Score history chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Score history</h2>
          {latestScore && (
            <span className="text-xs text-gray-400">
              Updated {formatDate(latestScore.calculatedAt)}
            </span>
          )}
        </div>
        <ScoreHistoryChart history={scoreHistory} />
      </div>

      {/* Why this score */}
      {latestScore && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SignalBreakdown explanation={latestScore.explanationJson} />
        </div>
      )}

      {/* Sentiment (separate) */}
      {latestScore && (
        <SentimentPanel
          sentimentScore={latestScore.sentimentScore}
          controversyScore={latestScore.controversyScore}
        />
      )}

      {/* Data sources */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Data sources</h2>
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
          ].map((source) => (
            <div key={source.name} className="flex items-center justify-between border-b border-gray-100 pb-1.5">
              <span className="text-gray-700">{source.name}</span>
              <DataSourceBadge type={source.type} />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Partial: Reddit requires API credentials and will show as unavailable until configured.
        </p>
      </div>
    </div>
  );
}
