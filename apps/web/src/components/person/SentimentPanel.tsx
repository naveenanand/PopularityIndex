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
      <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-400">
        Sentiment data not available
      </div>
    );
  }

  const tone = sentimentScore > 20 ? 'Positive' : sentimentScore < -20 ? 'Negative' : 'Neutral';
  const toneColor =
    sentimentScore > 20
      ? 'text-green-600'
      : sentimentScore < -20
        ? 'text-red-600'
        : 'text-gray-600';

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Sentiment</h3>
        <DataSourceBadge type="mock" label="Mock data" />
      </div>
      <div className="flex items-baseline gap-3">
        <span className={`text-2xl font-bold ${toneColor}`}>{tone}</span>
        <span className="text-gray-400 text-sm">{sentimentScore.toFixed(0)} / 100</span>
      </div>
      {positiveShare !== undefined && (
        <div className="flex gap-2 text-xs">
          <span className="text-green-600">{Math.round(positiveShare * 100)}% positive</span>
          <span className="text-gray-400">{Math.round((neutralShare ?? 0) * 100)}% neutral</span>
          <span className="text-red-500">{Math.round((negativeShare ?? 0) * 100)}% negative</span>
        </div>
      )}
      {controversyScore !== null && (
        <div className="text-xs text-gray-400">
          Controversy: {Math.round(controversyScore)}/100
        </div>
      )}
      <p className="text-xs text-gray-400 italic">
        Sentiment is displayed separately and is not included in the Popularity or Heat score.
      </p>
    </div>
  );
}
