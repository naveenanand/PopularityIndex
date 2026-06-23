import { getPersonRawObservations } from '../../lib/api';
import { computeLiveScore } from '../../lib/live-score';
import { SignalBreakdown } from './SignalBreakdown';
import { SentimentPanel } from './SentimentPanel';
import { TopArticles } from './TopArticles';
import { formatScore, coverageBadgeColor } from '../../lib/formatters';

interface Props {
  personId: number;
  displayName: string;
}

export async function LiveScoreSection({ personId, displayName }: Props) {
  const rawObs = await getPersonRawObservations(personId);
  const liveResult = await computeLiveScore(personId, displayName, rawObs);
  const score = liveResult.score;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-indigo-600">{formatScore(score.popularityScore)}</div>
          <div className="text-xs text-gray-500 mt-1">Popularity</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-amber-500">{formatScore(score.heatScore)}</div>
          <div className="text-xs text-gray-500 mt-1">Heat (trending)</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-gray-700">{Math.round(score.coverageScore)}</div>
          <div className="mt-1">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${coverageBadgeColor(score.explanationJson.coverage_label)}`}>
              {score.explanationJson.coverage_label}
            </span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-gray-700">{Math.round(score.confidenceScore)}</div>
          <div className="text-xs text-gray-500 mt-1">Confidence</div>
        </div>
      </div>

      <TopArticles articles={liveResult.articles} />

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <SignalBreakdown explanation={score.explanationJson} />
      </div>

      <SentimentPanel
        sentimentScore={score.sentimentScore}
        controversyScore={score.controversyScore}
      />
    </>
  );
}

export function LiveScoreSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm animate-pulse">
            <div className="h-9 bg-gray-100 rounded-md mx-auto w-16 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-20 mx-auto" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-pulse space-y-3">
        <div className="h-4 bg-gray-100 rounded w-32" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-50 rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
}
