import { providerBadgeColor } from '../../lib/formatters';

interface Props {
  type: 'live' | 'mock' | 'unavailable' | 'partial';
  label?: string;
}

const LABELS = {
  live: 'Live',
  mock: 'Mock',
  unavailable: 'N/A',
  partial: 'Partial',
};

export function DataSourceBadge({ type, label }: Props) {
  const colorClass =
    type === 'partial'
      ? 'bg-blue-100 text-blue-800 border-blue-200'
      : providerBadgeColor(type);

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${type === 'live' ? 'bg-green-500' : type === 'mock' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
      {label ?? LABELS[type]}
    </span>
  );
}
