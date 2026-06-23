import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPersonWithScores, getPersonPhoto } from '../../../lib/api';
import { ScoreHistoryChart } from '../../../components/person/ScoreHistoryChart';
import { DataSourceBadge } from '../../../components/shared/DataSourceBadge';
import { LiveScoreSection, LiveScoreSkeleton } from '../../../components/person/LiveScoreSection';
import { formatDate } from '../../../lib/formatters';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ wikidataQid: string }>;
}

export default async function PersonPage({ params }: PageProps) {
  const { wikidataQid } = await params;
  const data = await getPersonWithScores(wikidataQid);

  if (!data) return notFound();

  const { person, scoreHistory } = data;

  // Photo comes from DB (fast) if the expand-people job has populated it,
  // otherwise falls back to a Wikipedia API call (still faster than blocking scores)
  const photoUrl = await getPersonPhoto(person.displayName);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header — renders immediately from DB */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {photoUrl ? (
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
        <div className="flex flex-col items-end gap-1">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">
            ← Leaderboard
          </Link>
          <span className="text-[10px] text-gray-300">Live · refreshes every 60s</span>
        </div>
      </div>

      {/* Live scores + articles — streams in while page is already visible */}
      <Suspense fallback={<LiveScoreSkeleton />}>
        <LiveScoreSection personId={person.id} displayName={person.displayName} />
      </Suspense>

      {/* Score history — from DB, renders with the header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Score history</h2>
          <span className="text-xs text-gray-400">
            {scoreHistory[0] ? `Last snapshot ${formatDate(scoreHistory[0].calculatedAt)}` : 'No history yet'}
          </span>
        </div>
        <ScoreHistoryChart history={scoreHistory} />
      </div>

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
          Scores computed live on each visit. Reddit requires API credentials to be configured.
        </p>
      </div>
    </div>
  );
}
