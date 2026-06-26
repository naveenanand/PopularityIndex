export const revalidate = 60;

import Link from 'next/link';
import { Suspense } from 'react';
import { getPersonWithScores, getLeaderboard } from '../../lib/api';
import { formatScore, formatDate, coverageBadgeColor } from '../../lib/formatters';
import { ComparePickList } from '../../components/compare/ComparePickList';
import { BioFactsSection } from '../../components/person/BioFactsSection';
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

export default async function ComparePage({ searchParams }: PageProps) {
  const { a, b } = await searchParams;

  // ── Pick mode: a is set, b is not ──────────────────────────────────────────
  if (a && !b) {
    const [dataA, leaderboard] = await Promise.all([
      getPersonWithScores(a),
      getLeaderboard('popularity', 100, 0),
    ]);

    // Filter out person A from the list
    const pickList = leaderboard
      .filter(p => p.wikidataQid !== a)
      .map(p => ({
        wikidataQid: p.wikidataQid,
        displayName: p.displayName,
        occupationSummary: p.occupationSummary,
        photoUrl: p.photoUrl ?? null,
        popularityScore: p.popularityScore,
      }));

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 uppercase tracking-widest font-semibold">
          <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-zinc-500">Compare</span>
        </div>

        {/* Header with selected person chip */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-white">Comparing</h1>
          <p className="text-zinc-500 text-sm">Select someone to compare against</p>
        </div>

        {/* Selected person chip */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-red-600/10 border border-red-600/30 rounded-full pl-2 pr-3 py-1.5">
            {dataA?.person.photoUrl ? (
              <img
                src={dataA.person.photoUrl}
                alt={dataA.person.displayName}
                className="w-6 h-6 rounded-full object-cover object-top flex-shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-[10px] flex-shrink-0">
                {dataA?.person.displayName[0]}
              </div>
            )}
            <span className="text-sm font-semibold text-white">
              {dataA?.person.displayName ?? a}
            </span>
            <span className="text-xs text-zinc-500">
              {dataA?.latestScore ? formatScore(dataA.latestScore.popularityScore) : '—'}
            </span>
            <Link
              href="/compare"
              className="text-zinc-500 hover:text-zinc-300 ml-1 transition-colors"
              title="Remove"
            >
              ×
            </Link>
          </div>

          <span className="text-zinc-600 text-sm font-medium">vs</span>

          <div className="flex items-center gap-2 bg-zinc-800 border border-dashed border-zinc-600 rounded-full px-3 py-1.5">
            <span className="text-sm text-zinc-500">Pick someone below</span>
          </div>
        </div>

        {/* Scrollable person pick list with search */}
        <ComparePickList people={pickList} qidA={a} />
      </div>
    );
  }

  // ── Full comparison: both a and b are set ───────────────────────────────────
  const [dataA, dataB] = await Promise.all([
    a ? getPersonWithScores(a) : Promise.resolve(null),
    b ? getPersonWithScores(b) : Promise.resolve(null),
  ]);

  const explanationA = dataA?.latestScore?.explanationJson as ScoreExplanation | undefined;
  const explanationB = dataB?.latestScore?.explanationJson as ScoreExplanation | undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-600 uppercase tracking-widest font-semibold">
        <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
        <span>/</span>
        <span className="text-zinc-500">Compare</span>
      </div>

      {/* Selected people chips + controls */}
      <div className="space-y-3">
        <h1 className="text-2xl font-black text-white">Head-to-Head</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Person A chip */}
          <div className="flex items-center gap-2 bg-red-600/10 border border-red-600/30 rounded-full pl-2 pr-3 py-1.5">
            {dataA?.person.photoUrl ? (
              <img src={dataA.person.photoUrl} alt={dataA.person.displayName}
                className="w-6 h-6 rounded-full object-cover object-top flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-[10px]">
                {dataA?.person.displayName[0]}
              </div>
            )}
            <span className="text-sm font-semibold text-white">{dataA?.person.displayName ?? a}</span>
            {b && (
              <Link href={`/compare?a=${b}`} className="text-zinc-500 hover:text-red-400 ml-1 transition-colors" title="Remove">×</Link>
            )}
          </div>

          <span className="text-zinc-500 font-bold">vs</span>

          {/* Person B chip */}
          <div className="flex items-center gap-2 bg-blue-600/10 border border-blue-600/30 rounded-full pl-2 pr-3 py-1.5">
            {dataB?.person.photoUrl ? (
              <img src={dataB.person.photoUrl} alt={dataB.person.displayName}
                className="w-6 h-6 rounded-full object-cover object-top flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-[10px]">
                {dataB?.person.displayName[0]}
              </div>
            )}
            <span className="text-sm font-semibold text-white">{dataB?.person.displayName ?? b}</span>
            {a && (
              <Link href={`/compare?a=${a}`} className="text-zinc-500 hover:text-blue-400 ml-1 transition-colors" title="Remove">×</Link>
            )}
          </div>

          {/* Swap */}
          {a && b && (
            <Link
              href={`/compare?a=${b}&b=${a}`}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
            >
              Swap ↔
            </Link>
          )}
        </div>
      </div>

      {/* Side-by-side person cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {([
          { data: dataA, accent: 'border-red-600/30', fallbackQid: a },
          { data: dataB, accent: 'border-blue-600/30', fallbackQid: b },
        ] as const).map(({ data, accent, fallbackQid }, idx) => (
          <div key={idx} className={`bg-zinc-900 border ${accent} rounded-2xl p-6 flex flex-col items-center gap-4`}>
            {data ? (
              <>
                {data.person.photoUrl ? (
                  <img
                    src={data.person.photoUrl}
                    alt={data.person.displayName}
                    className="w-20 h-20 rounded-full object-cover object-top border-4 border-zinc-800"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-zinc-700 border-4 border-zinc-800 flex items-center justify-center text-zinc-300 font-black text-3xl">
                    {data.person.displayName.charAt(0)}
                  </div>
                )}
                <div className="text-center">
                  <Link href={`/people/${data.person.wikidataQid}`}
                    className="font-black text-lg text-white hover:text-red-400 transition-colors">
                    {data.person.displayName}
                  </Link>
                  {data.person.occupationSummary && (
                    <p className="text-zinc-500 text-xs capitalize mt-0.5">
                      {data.person.occupationSummary.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>
                {data.latestScore && (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <div className="bg-zinc-950 rounded-xl p-3 text-center border border-zinc-800">
                      <div className="text-2xl font-black text-amber-400">{formatScore(data.latestScore.popularityScore)}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Popularity</div>
                    </div>
                    <div className="bg-zinc-950 rounded-xl p-3 text-center border border-zinc-800">
                      <div className="text-2xl font-black text-orange-400">{formatScore(data.latestScore.heatScore)}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Heat</div>
                    </div>
                  </div>
                )}
                {/* Bio facts — compact inline version */}
                <Suspense fallback={null}>
                  <BioFactsSection wikidataQid={data.person.wikidataQid} />
                </Suspense>
              </>
            ) : (
              <p className="text-zinc-500 text-sm py-8">Not found: {fallbackQid}</p>
            )}
          </div>
        ))}
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
                <th className="py-3 pl-6 text-left w-32">Metric</th>
                <th className="py-3 pr-2 text-right">{dataA.person.displayName.split(' ')[0]}</th>
                <th className="py-3 px-4 text-center w-12">diff</th>
                <th className="py-3 pl-2 pr-6 text-left">{dataB.person.displayName.split(' ')[0]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {METRICS.map(({ label, key, color }) => {
                const sA = dataA.latestScore![key];
                const sB = dataB.latestScore![key];
                return (
                  <tr key={key} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 pl-6 text-zinc-500">{label}</td>
                    <td className="py-3 pr-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <WinIndicator aScore={sA} bScore={sB} />
                        <span className={`font-bold text-base ${color}`}>{formatScore(sA)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-zinc-600 text-xs tabular-nums">
                      {Math.abs(sA - sB).toFixed(1)}
                    </td>
                    <td className="py-3 pl-2 pr-6">
                      <div className="inline-flex items-center gap-2">
                        <span className={`font-bold text-base ${color}`}>{formatScore(sB)}</span>
                        <WinIndicator aScore={sB} bScore={sA} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-6 py-3 text-xs text-zinc-700 border-t border-zinc-800 flex items-center justify-between">
            <span>Scores as of {formatDate(dataA.latestScore.calculatedAt)}</span>
            {a && b && (
              <Link href={`/compare?a=${a}`} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                Change person B
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Top signals */}
      {(explanationA?.top_contributors || explanationB?.top_contributors) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            { exp: explanationA, name: dataA?.person.displayName, color: 'text-red-400' },
            { exp: explanationB, name: dataB?.person.displayName, color: 'text-blue-400' },
          ] as const).map(({ exp, name, color }) =>
            exp?.top_contributors ? (
              <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <h3 className={`font-bold text-sm ${color}`}>{name} — Top Signals</h3>
                <div className="space-y-2">
                  {exp.top_contributors.slice(0, 5).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-zinc-800/60 pb-1.5 last:border-0">
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
          {[explanationA, explanationB].map((exp, i) => (
            <div key={i}>
              <span className={`inline-block px-3 py-1 rounded-full text-xs border ${coverageBadgeColor(exp?.coverage_label ?? 'Partial coverage')}`}>
                {exp?.coverage_label ?? 'Unknown coverage'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
