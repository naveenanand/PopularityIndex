import Link from 'next/link';
import type { LeaderboardEntry } from '../../lib/api';

interface Props {
  person: LeaderboardEntry;
}

export function HeroSection({ person }: Props) {
  const occupation = person.occupationSummary?.replace(/_/g, ' ') ?? '';

  return (
    <div className="relative w-full h-[60vh] min-h-[400px] max-h-[700px] overflow-hidden">
      {/* Background photo */}
      {person.photoUrl ? (
        <img
          src={person.photoUrl}
          alt={person.displayName}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
      )}

      {/* Gradient overlays — left-to-right fade + top-bottom dark */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]/30" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end pb-12 px-6 sm:px-10 max-w-2xl">
        {/* Category */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-red-500 text-xs font-bold uppercase tracking-widest">
            #{person.rank} Most Popular
          </span>
          {occupation && (
            <>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400 text-xs capitalize">{occupation}</span>
            </>
          )}
        </div>

        {/* Name */}
        <h1 className="text-4xl sm:text-6xl font-black text-white leading-none tracking-tight mb-3">
          {person.displayName}
        </h1>

        {/* Score pills */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="text-amber-400 text-sm font-bold">{Math.round(person.popularityScore)}</span>
            <span className="text-zinc-400 text-xs">Popularity</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="text-orange-400 text-sm font-bold">{Math.round(person.heatScore)}</span>
            <span className="text-zinc-400 text-xs">Heat</span>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
            person.coverageLabel === 'High coverage'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-zinc-700/50 text-zinc-400'
          }`}>
            {person.coverageLabel}
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href={`/people/${person.wikidataQid}`}
            className="flex items-center gap-2 bg-white text-black font-bold px-6 py-2.5 rounded-lg hover:bg-zinc-200 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            View Profile
          </Link>
          <Link
            href="/browse"
            className="flex items-center gap-2 bg-zinc-700/70 backdrop-blur-sm text-white font-bold px-6 py-2.5 rounded-lg hover:bg-zinc-600 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Browse All
          </Link>
        </div>
      </div>
    </div>
  );
}
