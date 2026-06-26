export const revalidate = 60;

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPersonWithScores } from '../../lib/api';
import { formatScore, formatDate, coverageBadgeColor } from '../../lib/formatters';
import { ComparePicker } from '../../components/compare/ComparePicker';
import type { ScoreExplanation } from '@pai/shared';

type SearchParams = Promise<{ a?: string; b?: string }>;

interface PageProps {
  searchParams: SearchParams;
}

function WinIndicator({ aScore, bScore }: { aScore: number; bScore: number }) {
  if (Math.abs(aScore - bScore) < 0.5) return null;
  return aScore > bScore
    ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">WINS</span>
    : <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">LOSES</span>;
}

const METRICS = [
  { label: 'Popularity', key: 'popularityScore' as const, color: 'text-amber-400' },
  { label: 'Heat',       key: 'heatScore'       as const, color: 'text-orange-400' },
  { label: 'Coverage',   key: 'coverageScore'   as const, color: 'text-zinc-300' },
  { label: 'Confidence', key: 'confidenceScore' as const, color: 'text-zinc-300' },
];

function PersonCard({ data }: { data: NonNullable<Awaited<ReturnType<typeof getPersonWithScores>>> }) {
  const { person, latestScore } = data;
  return (
    <div className="space-y-4">
      <div className="text-center space-y-3">
        {person.photoUrl ? (
          <img
            src={person.photoUrl}
            alt={person.displayName}
            className="w-24 h-24 rounded-full object-cover object-top border-4 border-zinc-800 mx-auto"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-zinc-700 border-4 border-zinc-800 flex items-center justify-center text-zinc-300 font-black text-3xl mx-auto">
            {person.displayName.charAt(0)}
          </div>
        )}
        <div>
          <Link
            href={`/people/${person.wikidataQid}`}
            className="font-black text-xl text-white hover:text-red-400 transition-colors"
          >
            {person.displayName}
          </Link>
          {person.occupationSummary && (
            <p className="text-zinc-500 text-sm capitalize mt-0.5">
              {person.occupationSummary.replace(/_/g, ' ')}
            </p>
          )}
          <span className="text-[10px] font-mono text-zinc-700">{person.wikidataQid}</span>
        </div>
      </div>

      {latestScore ? (
        <div className="space-y-2">
          {METRICS.map(m => (
            <div key={m.key} className="bg-zinc-950 rounded-xl p-4 text-center border border-zinc-800">
              <div className={`text-3xl font-black ${m.color}`}>{formatScore(latestScore[m.key])}</div>
              <div className="text-xs text-zinc-500 mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 text-center text-zinc-500 text-sm">
          No score yet
        </div>
      )}
    </div>
  );
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { a, b } = await searchParams;

  // No params at all — full empty state
  if (!a && !b) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <div>
          <h1 className="text-3xl font-black text-white">Compare Two People</h1>
          <p className="text-zinc-500 text-sm mt-2">
            Compare popularity scores, heat, and signals side by side.
          </p>
        </div>
        <ComparePicker qidA={null} nameA={null} />
      </div>
    );
  }

  // Only A provided — show person A + picker for B
  if (a && !b) {
    const dataA = await getPersonWithScores(a);
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="flex items-center gap-2 text-xs text-zinc-600 uppercase tracking-widest font-semibold">
          <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-zinc-500">Compare</span>
        </div>

        <div>
          <h1 className="text-3xl font-black text-white">Compare</h1>
          <p className="text-zinc-500 text-sm mt-1">Search for a second person to compare.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          {/* Person A */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            {dataA ? <PersonCard data={dataA} /> : (
              <p className="text-zinc-500 text-center py-8">Person not found: {a}</p>
            )}
          </div>

          {/* Search for B */}
          <div className="bg-zinc-900 border border-zinc-700 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px] space-y-4">
            <p className="text-zinc-400 font-semibold">Pick someone to compare against</p>
            <ComparePicker qidA={a} nameA={dataA?.person.displayName ?? null} />
          </div>
        </div>
      </div>
    );
  }

  // Both A and B provided — full comparison
  const [dataA, dataB] = await Promise.all([
    a ? getPersonWithScores(a) : Promise.resolve(null),
    b ? getPersonWithScores(b) : Promise.resolve(null),
  ]);

  if (!dataA && !dataB) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-400 text-lg font-medium">Neither person was found.</p>
        <Link href="/browse" className="text-sm text-red-400 hover:underline mt-4 inline-block">Browse all people →</Link>
      </div>
    );
  }

  const explanationA = dataA?.latestScore?.explanationJson as ScoreExplanation | undefined;
  const explanationB = dataB?.latestScore?.explanationJson as ScoreExplanation | undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="flex items-center gap-2 text-xs text-zinc-600 uppercase tracking-widest font-semibold">
        <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
        <span>/</span>
        <span className="text-zinc-500">Compare</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-white">Head-to-Head</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {dataA?.person.displayName ?? a} vs {dataB?.person.displayName ?? b}
          </p>
        </div>
        {/* Swap / change */}
        <div className="flex gap-2">
          {a && b && (
            <Link
              href={`/compare?a=${b}&b=${a}`}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg px-3 py-1.5 transition-colors"
            >
              Swap ↔
            </Link>
          )}
          {a && (
            <Link
              href={`/compare?a=${a}`}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg px-3 py-1.5 transition-colors"
            >
              Change B
            </Link>
          )}
        </div>
      </div>

      {/* Side-by-side cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {dataA
          ? <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6"><PersonCard data={dataA} /></div>
          : <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center py-12 text-zinc-500">Not found: {a}</div>
        }
        {dataB
          ? <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6"><PersonCard data={dataB} /></div>
          : <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center py-12 text-zinc-500">Not found: {b}</div>
        }
      </div>

      {/* Score comparison table */}
      {dataA?.latestScore && dataB?.latestScore && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="font-bold text-white">Score Comparison</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-600 uppercase tracking-wide">
                <th className="py-3 pl-6 text-left">Metric</th>
                <th className="py-3 pr-2 text-right">{dataA.person.displayName.split(' ')[0]}</th>
                <th className="py-3 px-4 text-center">diff</th>
                <th className="py-3 pl-2 pr-6 text-left">{dataB.person.displayName.split(' ')[0]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {METRICS.map(({ label, key, color }) => {
                const sA = dataA.latestScore![key];
                const sB = dataB.latestScore![key];
                return (
                  <tr key={key}>
                    <td className="py-3 pl-6 text-zinc-500">{label}</td>
                    <td className="py-3 pr-2 text-right">
                      <span className={`font-bold ${color}`}>{formatScore(sA)}</span>
                      <span className="ml-2"><WinIndicator aScore={sA} bScore={sB} /></span>
                    </td>
                    <td className="py-3 px-4 text-center text-zinc-700 text-xs tabular-nums">
                      {Math.abs(sA - sB).toFixed(1)}
                    </td>
                    <td className="py-3 pl-2 pr-6">
                      <span className={`font-bold ${color}`}>{formatScore(sB)}</span>
                      <span className="ml-2"><WinIndicator aScore={sB} bScore={sA} /></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-6 py-3 text-xs text-zinc-700 border-t border-zinc-800">
            Scores as of {formatDate(dataA.latestScore.calculatedAt)} · {formatDate(dataB.latestScore.calculatedAt)}
          </div>
        </div>
      )}

      {/* Top signals */}
      {(explanationA?.top_contributors || explanationB?.top_contributors) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {([
            { exp: explanationA, name: dataA?.person.displayName },
            { exp: explanationB, name: dataB?.person.displayName },
          ] as const).map(({ exp, name }) =>
            exp?.top_contributors ? (
              <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-white text-sm">{name} — Top Signals</h3>
                <div className="space-y-2">
                  {exp.top_contributors.slice(0, 4).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-zinc-800/60 pb-1.5">
                      <span className="text-zinc-400 capitalize">{c.signal.replace(/_/g, ' ')}</span>
                      <span className={`font-mono ${parseFloat(c.impact) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {c.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Coverage */}
      {(explanationA?.coverage_label || explanationB?.coverage_label) && (
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs border ${coverageBadgeColor(explanationA?.coverage_label ?? 'Partial coverage')}`}>
              {explanationA?.coverage_label ?? 'Unknown coverage'}
            </span>
          </div>
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs border ${coverageBadgeColor(explanationB?.coverage_label ?? 'Partial coverage')}`}>
              {explanationB?.coverage_label ?? 'Unknown coverage'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
