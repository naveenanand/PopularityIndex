import { DataSourceBadge } from '../shared/DataSourceBadge';

interface Props {
  sentimentScore: number | null;
  controversyScore: number | null;
  positiveShare?: number;
  neutralShare?: number;
  negativeShare?: number;
}

export function SentimentPanel({ sentimentScore, controversyScore, positiveShare, neutralShare, negativeShare }: Props) {
  if (sentimentScore === null) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-600">
        Sentiment data not available
      </div>
    );
  }

  const tone = sentimentScore > 20 ? 'Positive' : sentimentScore < -20 ? 'Negative' : 'Neutral';
  const toneColor =
    sentimentScore > 20
      ? 'text-emerald-400'
      : sentimentScore < -20
        ? 'text-red-400'
        : 'text-zinc-400';

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white text-sm">Sentiment</h3>
        <DataSourceBadge type="mock" label="Mock data" />
      </div>
      <div className="flex items-baseline gap-3">
        <span className={`text-2xl font-black ${toneColor}`}>{tone}</span>
        <span className="text-zinc-500 text-sm">{sentimentScore.toFixed(0)} / 100</span>
      </div>
      {positiveShare !== undefined && (
        <div className="flex gap-3 text-xs">
          <span className="text-emerald-400">{Math.round(positiveShare * 100)}% positive</span>
          <span className="text-zinc-500">{Math.round((neutralShare ?? 0) * 100)}% neutral</span>
          <span className="text-red-400">{Math.round((negativeShare ?? 0) * 100)}% negative</span>
        </div>
      )}
      {controversyScore !== null && (
        <div className="text-xs text-zinc-600">
          Controversy score: {Math.round(controversyScore)}/100
        </div>
      )}
      <p className="text-xs text-zinc-700 italic">
        Sentiment is not included in Popularity or Heat scores.
      </p>
    </div>
  );
}
