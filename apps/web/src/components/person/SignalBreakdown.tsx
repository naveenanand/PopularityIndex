import type { ScoreExplanation } from '@pai/shared';
import { DataSourceBadge } from '../shared/DataSourceBadge';

interface Props {
  explanation: ScoreExplanation;
}

export function SignalBreakdown({ explanation }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900 text-sm">Why this score</h3>
      <div className="space-y-2">
        {explanation.top_contributors.map((c, i) => (
          <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
            <div className="w-12 text-right shrink-0">
              <span className="text-sm font-mono font-semibold text-indigo-600">
                {c.impact}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{c.signal}</span>
                <DataSourceBadge type={c.provider_type} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{c.reason}</p>
            </div>
          </div>
        ))}
      </div>
      {explanation.signals_missing.length > 0 && (
        <div className="text-xs text-gray-400 pt-1">
          Missing signals (not counted):{' '}
          {explanation.signals_missing
            .slice(0, 4)
            .map((s) => s.replace(/([A-Z])/g, ' $1').toLowerCase())
            .join(', ')}
          {explanation.signals_missing.length > 4 && ` +${explanation.signals_missing.length - 4} more`}
        </div>
      )}
    </div>
  );
}
