import type { ScoreExplanation } from '@pai/shared';
import { DataSourceBadge } from '../shared/DataSourceBadge';

interface Props {
  explanation: ScoreExplanation;
}

export function SignalBreakdown({ explanation }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-white text-sm">Why This Score</h3>
      <div className="space-y-1">
        {explanation.top_contributors.map((c, i) => (
          <div key={i} className="flex items-start gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
            <div className="w-12 text-right shrink-0">
              <span className="text-sm font-mono font-bold text-amber-400">
                {c.impact}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-zinc-200">{c.signal}</span>
                <DataSourceBadge type={c.provider_type} />
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{c.reason}</p>
            </div>
          </div>
        ))}
      </div>
      {explanation.signals_missing.length > 0 && (
        <div className="text-xs text-zinc-600 pt-1">
          Missing (not counted):{' '}
          {explanation.signals_missing
            .slice(0, 4)
            .map(s => s.replace(/([A-Z])/g, ' $1').toLowerCase())
            .join(', ')}
          {explanation.signals_missing.length > 4 && ` +${explanation.signals_missing.length - 4} more`}
        </div>
      )}
    </div>
  );
}
