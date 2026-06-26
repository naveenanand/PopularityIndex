import Link from 'next/link';
import type { MoverEntry } from '../../lib/api';

interface Props {
  rising: MoverEntry[];
  falling: MoverEntry[];
}

function MoverRow({ mover, direction }: { mover: MoverEntry; direction: 'up' | 'down' }) {
  const isUp = direction === 'up';
  return (
    <Link
      href={`/people/${mover.wikidataQid}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all group"
    >
      {mover.photoUrl ? (
        <img
          src={mover.photoUrl}
          alt={mover.displayName}
          className="w-9 h-9 rounded-full object-cover object-top flex-shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-xs flex-shrink-0">
          {mover.displayName[0]}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white text-sm group-hover:text-zinc-100 truncate">
          {mover.displayName}
        </p>
        {mover.occupationSummary && (
          <p className="text-zinc-600 text-xs capitalize truncate">
            {mover.occupationSummary.replace(/_/g, ' ')}
          </p>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <p className={`font-bold text-sm ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{mover.delta.toFixed(1)}
        </p>
        <p className="text-zinc-600 text-xs">
          {Math.round(mover.currentScore)} now
        </p>
      </div>

      <span className={`text-lg flex-shrink-0 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
        {isUp ? '↑' : '↓'}
      </span>
    </Link>
  );
}

export function MoversSection({ rising, falling }: Props) {
  if (rising.length === 0 && falling.length === 0) return null;

  return (
    <section className="px-6 sm:px-8 space-y-6">
      <h2 className="text-lg font-bold text-white">Score Movers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Rising */}
        {rising.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-emerald-400 text-sm font-bold">Rising Stars</span>
              <span className="text-zinc-600 text-xs">— biggest gains (48h)</span>
            </div>
            {rising.map(m => <MoverRow key={m.wikidataQid} mover={m} direction="up" />)}
          </div>
        )}

        {/* Falling */}
        {falling.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-red-400 text-sm font-bold">Biggest Drops</span>
              <span className="text-zinc-600 text-xs">— biggest losses (48h)</span>
            </div>
            {falling.map(m => <MoverRow key={m.wikidataQid} mover={m} direction="down" />)}
          </div>
        )}
      </div>
    </section>
  );
}
