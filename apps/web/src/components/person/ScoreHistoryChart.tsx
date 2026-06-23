'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatDate } from '../../lib/formatters.js';

interface HistoryPoint {
  calculatedAt: Date | string;
  popularityScore: number;
  heatScore: number;
}

interface Props {
  history: HistoryPoint[];
}

export function ScoreHistoryChart({ history }: Props) {
  if (history.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
        Not enough history to show a chart yet. Run{' '}
        <code className="mx-1 font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
          pnpm score:calculate
        </code>{' '}
        on multiple days.
      </div>
    );
  }

  const data = [...history]
    .sort(
      (a, b) =>
        new Date(a.calculatedAt).getTime() - new Date(b.calculatedAt).getTime(),
    )
    .map((s) => ({
      date: formatDate(s.calculatedAt),
      Popularity: Math.round(s.popularityScore * 10) / 10,
      Heat: Math.round(s.heatScore * 10) / 10,
    }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="Popularity"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="Heat"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
