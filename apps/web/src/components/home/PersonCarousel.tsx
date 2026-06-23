import Link from 'next/link';
import type { LeaderboardEntry } from '../../lib/api';
import { PersonCard } from './PersonCard';

interface Props {
  title: string;
  icon?: string;
  entries: LeaderboardEntry[];
  seeAllHref?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PersonCarousel({ title, icon, entries, seeAllHref, size = 'md' }: Props) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-6 sm:px-8">
        <h2 className="text-lg font-bold text-white">
          {icon && <span className="mr-2">{icon}</span>}
          {title}
        </h2>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-sm text-zinc-400 hover:text-white transition-colors">
            See all →
          </Link>
        )}
      </div>

      {/* Horizontal scroll container */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-6 sm:px-8 pb-2">
        {entries.map(entry => (
          <PersonCard key={entry.wikidataQid} entry={entry} size={size} />
        ))}
      </div>
    </section>
  );
}
