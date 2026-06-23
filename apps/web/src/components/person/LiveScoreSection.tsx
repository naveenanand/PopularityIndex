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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center">
          <div className="text-3xl font-black text-amber-400">{formatScore(score.popularityScore)}</div>
          <div className="text-xs text-zinc-500 mt-1">Popularity</div>
        </div>
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center">
          <div className="text-3xl font-black text-orange-400">{formatScore(score.heatScore)}</div>
          <div className="text-xs text-zinc-500 mt-1">Heat</div>
        </div>
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center">
          <div className="text-3xl font-black text-zinc-200">{Math.round(score.coverageScore)}</div>
          <div className="mt-1.5">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${coverageBadgeColor(score.explanationJson.coverage_label)}`}>
              {score.explanationJson.coverage_label}
            </span>
          </div>
        </div>
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center">
          <div className="text-3xl font-black text-zinc-200">{Math.round(score.confidenceScore)}</div>
          <div className="text-xs text-zinc-500 mt-1">Confidence</div>
        </div>
      </div>

      <TopArticles articles={liveResult.articles} />

      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-center animate-pulse">
            <div className="h-9 bg-zinc-800 rounded-lg mx-auto w-16 mb-2" />
            <div className="h-3 bg-zinc-800 rounded w-20 mx-auto" />
          </div>
        ))}
      </div>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 animate-pulse space-y-3">
        <div className="h-4 bg-zinc-800 rounded w-32" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-zinc-800 rounded-xl" />
          ))}
        </div>
      </div>
    </>
  );
}
