import Link from 'next/link';
import type { ViewPerson } from '../../lib/api';

const AVATAR_COLORS = [
  'from-indigo-700 to-purple-800',
  'from-rose-700 to-red-900',
  'from-amber-600 to-orange-800',
  'from-emerald-700 to-teal-900',
  'from-sky-700 to-blue-900',
  'from-violet-700 to-purple-900',
  'from-pink-700 to-rose-900',
  'from-cyan-700 to-sky-900',
];

function avatarGradient(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h] ?? 'from-zinc-700 to-zinc-800';
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

interface Props {
  person: ViewPerson;
  size?: 'sm' | 'md' | 'lg';
}

export function PersonCard({ person, size = 'md' }: Props) {
  const dims = {
    sm: 'w-32 h-44',
    md: 'w-40 h-56',
    lg: 'w-48 h-64',
  }[size];

  return (
    <Link
      href={`/people/${person.wikidataQid}`}
      className={`flex-shrink-0 ${dims} relative group block rounded-xl overflow-hidden card-glow transition-all duration-300 hover:scale-105 hover:z-10`}
    >
      {person.photoUrl ? (
        <img
          src={person.photoUrl}
          alt={person.displayName}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${avatarGradient(person.displayName)} flex items-center justify-center`}>
          <span className="text-white/50 font-black text-4xl select-none">{initials(person.displayName)}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded leading-tight">
        #{person.rank}
      </div>

      <div className={`absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-[10px] font-bold px-1.5 py-0.5 rounded ${person.primaryColor}`}>
        {person.primaryScoreDisplay ?? Math.round(person.primaryScore)}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-bold text-sm leading-tight line-clamp-1">{person.displayName}</p>
        {person.occupationSummary && (
          <p className="text-zinc-400 text-[10px] mt-0.5 capitalize line-clamp-1">
            {person.occupationSummary.replace(/_/g, ' ')}
          </p>
        )}
      </div>
    </Link>
  );
}
